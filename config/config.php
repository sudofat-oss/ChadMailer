<?php

return [
    'mailer' => [
        'provider' => 'mailgun', // mailgun, sendgrid, amazonses, postmark
        'credentials' => [
            'api_key' => '',
            'domain' => '', // Pour Mailgun
            'access_key' => '', // Pour Amazon SES
            'secret_key' => '', // Pour Amazon SES
            'region' => 'us-east-1' // Pour Amazon SES
        ],
        'from_email' => '',
        'from_name' => '',
        'test_email' => ''
    ],
    'campaign' => [
        'default_delay' => 1, // secondes entre chaque email
        'randomize_delay' => false,
        'max_retries' => 3
    ],
    'paths' => [
        'templates' => __DIR__ . '/../templates',
        'campaigns' => __DIR__ . '/../campaigns',
        'uploads' => __DIR__ . '/../uploads',
        'storage' => __DIR__ . '/../storage'
    ]
];

