variable "aws_region" {
  description = "AWS region where infrastructure is created"
  type        = string
  default     = "eu-west-3"
}

variable "project_name" {
  description = "Project identifier used for naming"
  type        = string
  default     = "chess-puzzle"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "api_backend_url" {
  description = "Public URL for the Kubernetes ingress/API gateway service, proxied by AWS API Gateway"
  type        = string
  default     = "http://example.com"
}
