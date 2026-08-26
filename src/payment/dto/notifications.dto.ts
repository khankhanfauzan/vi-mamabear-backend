export class QrisNotificationDto {
    transaction_type:             string
    transaction_time:             string
    transaction_status:           string
    transaction_id:               string
    status_message:               string
    status_code:                  number
    signature_key:                string
    settlement_time:              string
    payment_type:                 string
    order_id:                     string
    merchant_id:                  string
    merchant_cross_reference_id:  string
    issuer:                       string
    gross_amount:                 number
    fraud_status:                 string
    currency:                     string
    acquirer:                     string
}
