use reqwest::Client;
use serde_json::{json, Value};

use crate::commands::provider_configs::ProviderConfig;
use crate::core::error::{AppError, AppResult};
use crate::mailer::message::{EmailMessage, SendResult};
use crate::providers::{json_response, HTTP_CLIENT};

fn base_url(sendgrid_region: Option<&str>) -> &'static str {
    match sendgrid_region.unwrap_or("").trim() {
        "eu" => "https://api.eu.sendgrid.com",
        _ => "https://api.sendgrid.com",
    }
}

pub async fn send_email(
    cfg: &ProviderConfig,
    message: &EmailMessage,
    client: &Client,
) -> AppResult<SendResult> {
    let api_key = cfg.api_key.trim();
    if api_key.is_empty() {
        return Err(AppError::Validation("Clé API SendGrid requise".into()));
    }
    let region = if cfg.sendgrid_region.is_empty() {
        None
    } else {
        Some(cfg.sendgrid_region.as_str())
    };
    let base = base_url(region);

    let mut content = Vec::new();
    if let Some(text) = message.text.as_deref().filter(|s| !s.trim().is_empty()) {
        content.push(json!({ "type": "text/plain", "value": text }));
    }
    if let Some(html) = message.html.as_deref().filter(|s| !s.trim().is_empty()) {
        content.push(json!({ "type": "text/html", "value": html }));
    }

    let mut from = json!({ "email": message.from_email });
    if let Some(name) = message
        .from_name
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        from["name"] = Value::String(name.to_string());
    }

    let mut to = json!({ "email": message.to_email });
    if let Some(name) = message.to_name.as_deref().filter(|s| !s.trim().is_empty()) {
        to["name"] = Value::String(name.to_string());
    }

    let mut payload = json!({
        "personalizations": [{ "to": [to] }],
        "from": from,
        "subject": message.subject,
        "content": content,
    });
    if let Some(reply_to) = message.reply_to.as_deref().filter(|s| !s.trim().is_empty()) {
        payload["reply_to"] = json!({ "email": reply_to });
    }
    let mut headers_obj = serde_json::Map::new();
    for (k, v) in message
        .unsubscribe_headers()
        .into_iter()
        .chain(message.headers.iter().cloned())
    {
        headers_obj.insert(k, Value::String(v));
    }
    if !headers_obj.is_empty() {
        payload["headers"] = Value::Object(headers_obj);
    }

    let response = client
        .post(format!("{base}/v3/mail/send"))
        .bearer_auth(api_key)
        .header("accept", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| AppError::Security(format!("SendGrid réseau: {e}")))?;

    let status = response.status();
    let message_id = response
        .headers()
        .get("x-message-id")
        .and_then(|v| v.to_str().ok())
        .map(String::from);
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(AppError::Security(format!(
            "SendGrid HTTP {}: {}",
            status.as_u16(),
            body.chars().take(400).collect::<String>()
        )));
    }

    Ok(SendResult {
        provider: "sendgrid".into(),
        message_id,
        raw: Some(json!({ "status": status.as_u16(), "body": body })),
    })
}

pub async fn ping(api_key: &str, sendgrid_region: Option<&str>) -> AppResult<Value> {
    if api_key.trim().is_empty() {
        return Err(AppError::Validation("Clé API SendGrid requise".into()));
    }
    let base = base_url(sendgrid_region);
    let profile = json_response(
        HTTP_CLIENT
            .get(format!("{base}/v3/user/profile"))
            .bearer_auth(api_key),
    )
    .await?;
    Ok(
        json!({ "provider": "sendgrid", "region": sendgrid_region.unwrap_or(""), "profile": profile }),
    )
}

pub async fn inspect(api_key: &str, sendgrid_region: Option<&str>) -> AppResult<Value> {
    if api_key.trim().is_empty() {
        return Err(AppError::Validation("Clé API SendGrid requise".into()));
    }

    let base = base_url(sendgrid_region);

    let profile = json_response(
        HTTP_CLIENT
            .get(format!("{base}/v3/user/profile"))
            .bearer_auth(api_key),
    )
    .await?;

    let scopes = json_response(
        HTTP_CLIENT
            .get(format!("{base}/v3/scopes"))
            .bearer_auth(api_key),
    )
    .await
    .unwrap_or(Value::Null);

    let account = json_response(
        HTTP_CLIENT
            .get(format!("{base}/v3/user/account"))
            .bearer_auth(api_key),
    )
    .await
    .unwrap_or(Value::Null);

    let verified = json_response(
        HTTP_CLIENT
            .get(format!("{base}/v3/verified_senders"))
            .bearer_auth(api_key),
    )
    .await
    .unwrap_or(Value::Null);

    Ok(json!({
        "provider": "sendgrid",
        "region": sendgrid_region.unwrap_or(""),
        "profile": profile,
        "account": account,
        "scopes": scopes,
        "verified_senders": verified,
    }))
}

pub async fn verified_senders(
    api_key: &str,
    sendgrid_region: Option<&str>,
) -> AppResult<Vec<Value>> {
    let base = base_url(sendgrid_region);
    let response = json_response(
        HTTP_CLIENT
            .get(format!("{base}/v3/verified_senders"))
            .bearer_auth(api_key),
    )
    .await?;

    let mut out = Vec::new();
    if let Some(results) = response.get("results").and_then(Value::as_array) {
        for item in results {
            let verified = item
                .get("verified")
                .and_then(|v| v.get("status"))
                .and_then(Value::as_bool)
                .unwrap_or(false);
            if !verified {
                continue;
            }
            let email = item
                .get("from_email")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            if email.is_empty() {
                continue;
            }
            let name = item
                .get("from_name")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let label = if name.is_empty() {
                email.clone()
            } else {
                format!("{name} <{email}>")
            };
            out.push(json!({
                "email": email,
                "name": name,
                "label": label,
            }));
        }
    }
    Ok(out)
}

pub async fn activity(
    api_key: &str,
    sendgrid_region: Option<&str>,
    limit: u32,
    status: Option<&str>,
    to_email: Option<&str>,
) -> AppResult<Value> {
    if api_key.trim().is_empty() {
        return Err(AppError::Validation("Clé API SendGrid requise".into()));
    }

    let base = base_url(sendgrid_region);
    let limit = limit.clamp(1, 100);

    let mut query_parts: Vec<String> = Vec::new();
    if let Some(s) = status.filter(|s| !s.is_empty()) {
        query_parts.push(format!("status=\"{s}\""));
    }
    if let Some(to) = to_email.filter(|s| !s.is_empty()) {
        query_parts.push(format!("to_email=\"{to}\""));
    }
    let query = if query_parts.is_empty() {
        None
    } else {
        Some(query_parts.join(" AND "))
    };

    let mut req = HTTP_CLIENT
        .get(format!("{base}/v3/messages"))
        .bearer_auth(api_key)
        .query(&[("limit", limit.to_string())]);
    if let Some(q) = &query {
        req = req.query(&[("query", q.clone())]);
    }

    let response = json_response(req).await?;

    let messages = response
        .get("messages")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    Ok(json!({
        "base_used": base,
        "messages": messages,
    }))
}
