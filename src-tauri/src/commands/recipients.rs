use std::collections::{BTreeMap, HashMap};
use std::path::Path;

use email_address::EmailAddress;
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::State;

use crate::app_state::AppState;
use crate::core::api::ApiResponse;
use crate::core::error::{AppError, AppResult};
use crate::storage;

#[derive(Debug, Deserialize)]
struct ParseRecipientsPayload {
    file_path: String,
    file_type: String,
    #[serde(default)]
    column_mapping: Option<HashMap<String, Value>>,
}

#[derive(Debug, Clone)]
pub struct ParseOutput {
    pub recipients: Vec<HashMap<String, String>>,
    pub headers: Vec<String>,
}

/// Public helper used by the campaign engine to load recipients off disk.
pub async fn parse_file(
    path: &Path,
    file_type: &str,
    column_mapping: Option<Value>,
) -> AppResult<ParseOutput> {
    let mapping_map = column_mapping.and_then(|v| match v {
        Value::Object(map) => Some(map.into_iter().collect::<HashMap<String, Value>>()),
        _ => None,
    });
    match file_type {
        "txt" => parse_txt(path).await,
        "csv" => parse_csv(path, mapping_map.as_ref()).await,
        other => Err(AppError::Validation(format!(
            "Type de fichier non supporté: {other}"
        ))),
    }
}

#[tauri::command]
pub async fn save_upload(
    state: State<'_, AppState>,
    filename: String,
    file_type: String,
    bytes: Vec<u8>,
) -> Result<ApiResponse<Value>, AppError> {
    if filename.trim().is_empty() {
        return Ok(ApiResponse::err("Nom de fichier manquant"));
    }
    if bytes.is_empty() {
        return Ok(ApiResponse::err("Fichier vide"));
    }

    storage::ensure_dir(&state.paths.uploads_dir).await?;
    let safe_name = sanitize_filename(&filename);
    let path = state
        .paths
        .uploads_dir
        .join(format!("{}_{}", uuid::Uuid::new_v4(), safe_name));
    tokio::fs::write(&path, bytes).await?;

    let mut validation = json!({});
    if file_type == "csv" {
        let parsed = parse_csv(&path, None).await?;
        validation["headers"] = json!(parsed.headers);
    }

    Ok(ApiResponse::ok(json!({
        "filepath": path.display().to_string(),
        "file_type": file_type,
        "validation": validation
    })))
}

pub async fn parse_recipients(data: Value) -> AppResult<ApiResponse<Value>> {
    let payload: ParseRecipientsPayload = serde_json::from_value(data)?;
    let mapping_value = payload
        .column_mapping
        .as_ref()
        .map(|m| Value::Object(m.clone().into_iter().collect()));
    let out = match parse_file(
        Path::new(&payload.file_path),
        &payload.file_type,
        mapping_value,
    )
    .await
    {
        Ok(out) => out,
        Err(AppError::Validation(msg)) => return Ok(ApiResponse::err(msg)),
        Err(e) => return Err(e),
    };

    let mut domains: BTreeMap<String, usize> = BTreeMap::new();
    for recipient in &out.recipients {
        if let Some(email) = recipient.get("email") {
            if let Some(domain) = email.split('@').nth(1) {
                *domains.entry(domain.to_ascii_lowercase()).or_default() += 1;
            }
        }
    }

    Ok(ApiResponse::ok(json!({
        "total": out.recipients.len(),
        "domains": domains,
        "headers": out.headers,
        "sample": out.recipients.iter().take(5).collect::<Vec<_>>()
    })))
}

async fn parse_txt(path: &Path) -> AppResult<ParseOutput> {
    let content = tokio::fs::read_to_string(path).await?;
    let mut recipients = Vec::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let mut row = HashMap::new();
        if line.contains('/') && line.matches('/').count() >= 2 {
            let parts: Vec<_> = line.splitn(3, '/').map(str::trim).collect();
            if parts.len() == 3 && EmailAddress::is_valid(parts[2]) {
                row.insert("first_name".to_string(), parts[0].to_string());
                row.insert("last_name".to_string(), parts[1].to_string());
                row.insert(
                    "name".to_string(),
                    format!("{} {}", parts[0], parts[1]).trim().to_string(),
                );
                row.insert("email".to_string(), parts[2].to_ascii_lowercase());
            }
        } else if EmailAddress::is_valid(line) {
            row.insert("email".to_string(), line.to_ascii_lowercase());
        }

        if row.contains_key("email") {
            add_name_aliases(&mut row);
            recipients.push(row);
        }
    }
    Ok(ParseOutput {
        recipients,
        headers: Vec::new(),
    })
}

async fn parse_csv(
    path: &Path,
    mapping: Option<&HashMap<String, Value>>,
) -> AppResult<ParseOutput> {
    let bytes = tokio::fs::read(path).await?;
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(bytes.as_slice());
    let headers: Vec<String> = reader.headers()?.iter().map(ToString::to_string).collect();

    let explicit = mapping
        .and_then(|m| m.get("email"))
        .and_then(Value::as_str)
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);

    let mut recipients = Vec::new();
    for record in reader.records() {
        let record = record?;
        let raw: HashMap<String, String> = headers
            .iter()
            .cloned()
            .zip(record.iter().map(|v| v.trim().to_string()))
            .collect();
        let mut row = if explicit {
            map_csv_explicit(&raw, mapping.expect("checked explicit"))
        } else {
            map_csv_auto(&raw)
        };
        let Some(email) = row.get("email").map(|s| s.trim().to_ascii_lowercase()) else {
            continue;
        };
        if !EmailAddress::is_valid(&email) {
            continue;
        }
        row.insert("email".to_string(), email);
        add_name_aliases(&mut row);
        recipients.push(row);
    }

    Ok(ParseOutput {
        recipients,
        headers,
    })
}

fn map_csv_auto(raw: &HashMap<String, String>) -> HashMap<String, String> {
    let mut row = HashMap::new();
    for (key, value) in raw {
        let normalized = key.trim().to_ascii_lowercase().replace(' ', "_");
        row.insert(normalized, value.trim().to_string());
    }
    if let Some(v) = row.remove("e-mail") {
        row.insert("email".to_string(), v);
    }
    row
}

fn map_csv_explicit(
    raw: &HashMap<String, String>,
    mapping: &HashMap<String, Value>,
) -> HashMap<String, String> {
    let mut row = HashMap::new();
    for key in ["email", "first_name", "last_name", "name", "prenom", "nom"] {
        if let Some(source) = mapping.get(key).and_then(Value::as_str).map(str::trim) {
            if !source.is_empty() {
                if let Some(value) = raw.get(source) {
                    row.insert(key.to_string(), value.trim().to_string());
                }
            }
        }
    }

    if let Some(custom) = mapping.get("custom_variables").and_then(Value::as_object) {
        for (var_name, source_value) in custom {
            let Some(source) = source_value.as_str().map(str::trim) else {
                continue;
            };
            if source.is_empty() {
                continue;
            }
            if let Some(value) = raw.get(source) {
                let normalized = normalize_variable_name(var_name);
                if !normalized.is_empty() {
                    row.insert(normalized, value.trim().to_string());
                }
            }
        }
    }

    row
}

fn normalize_variable_name(raw: &str) -> String {
    raw.trim()
        .to_ascii_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect::<String>()
        .trim_matches('_')
        .to_string()
}

fn add_name_aliases(row: &mut HashMap<String, String>) {
    if let Some(v) = row.get("first_name").cloned() {
        row.entry("prenom".to_string()).or_insert(v);
    }
    if let Some(v) = row.get("last_name").cloned() {
        row.entry("nom".to_string()).or_insert(v);
    }
    if let Some(v) = row.get("name").cloned() {
        row.entry("nom_complet".to_string()).or_insert(v.clone());
        row.entry("full_name".to_string()).or_insert(v);
    }
}

fn sanitize_filename(filename: &str) -> String {
    filename
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string()
}

#[allow(dead_code)]
fn missing_file(path: &Path) -> AppError {
    AppError::NotFound(path.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn tmp_file(name: &str, content: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir();
        let path = dir.join(format!("chadmailer-test-{}-{}", uuid::Uuid::new_v4(), name));
        let mut f = std::fs::File::create(&path).expect("tmp file");
        f.write_all(content.as_bytes()).expect("write");
        path
    }

    #[tokio::test]
    async fn parse_txt_handles_three_field_lines_and_plain_emails() {
        let path = tmp_file(
            "recipients.txt",
            "Alice/Smith/alice@example.com\nbob@example.org\nnot-an-email\n\n",
        );
        let out = parse_txt(&path).await.expect("parse ok");
        std::fs::remove_file(&path).ok();
        assert_eq!(out.recipients.len(), 2);
        assert_eq!(out.recipients[0].get("email").unwrap(), "alice@example.com");
        assert_eq!(out.recipients[0].get("first_name").unwrap(), "Alice");
        assert_eq!(out.recipients[0].get("last_name").unwrap(), "Smith");
        assert_eq!(out.recipients[0].get("prenom").unwrap(), "Alice");
        assert_eq!(out.recipients[1].get("email").unwrap(), "bob@example.org");
    }

    #[tokio::test]
    async fn parse_csv_auto_mapping_picks_email_column() {
        let path = tmp_file(
            "recipients.csv",
            "Email,First Name,Last Name\nalice@example.com,Alice,Smith\nINVALID,oops,oops\n",
        );
        let out = parse_csv(&path, None).await.expect("parse ok");
        std::fs::remove_file(&path).ok();
        assert_eq!(out.recipients.len(), 1);
        assert_eq!(out.recipients[0].get("email").unwrap(), "alice@example.com");
        assert!(out.headers.contains(&"Email".to_string()));
    }

    #[tokio::test]
    async fn parse_csv_explicit_mapping_supports_custom_variables() {
        let path = tmp_file(
            "recipients2.csv",
            "Adresse,Prénom,Société\nalice@example.com,Alice,Acme\n",
        );
        let mapping: HashMap<String, Value> = HashMap::from([
            ("email".to_string(), serde_json::json!("Adresse")),
            ("first_name".to_string(), serde_json::json!("Prénom")),
            (
                "custom_variables".to_string(),
                serde_json::json!({ "company": "Société" }),
            ),
        ]);
        let out = parse_csv(&path, Some(&mapping)).await.expect("parse ok");
        std::fs::remove_file(&path).ok();
        assert_eq!(out.recipients.len(), 1);
        assert_eq!(out.recipients[0].get("email").unwrap(), "alice@example.com");
        assert_eq!(out.recipients[0].get("first_name").unwrap(), "Alice");
        assert_eq!(out.recipients[0].get("company").unwrap(), "Acme");
    }

    #[test]
    fn sanitize_filename_strips_unsafe_chars() {
        assert_eq!(sanitize_filename("hello world!.csv"), "hello_world_.csv");
        // Path separators MUST be removed so an upload can't escape the
        // uploads directory (final names are also prefixed with a UUID).
        let sanitized = sanitize_filename("../etc/passwd");
        assert!(!sanitized.contains('/'));
        assert!(!sanitized.contains('\\'));
        assert_eq!(sanitized, ".._etc_passwd");
    }

    #[test]
    fn normalize_variable_name_keeps_alphanumeric_only() {
        assert_eq!(normalize_variable_name("Société"), "soci_t");
        assert_eq!(normalize_variable_name("  name 1 "), "name_1");
        assert_eq!(normalize_variable_name("___"), "");
    }
}
