output "api_gateway_invoke_url" {
  description = "Invoke URL for AWS API Gateway dev stage"
  value       = aws_apigatewayv2_stage.dev.invoke_url
}

output "api_gateway_id" {
  description = "AWS API Gateway HTTP API ID"
  value       = aws_apigatewayv2_api.this.id
}
