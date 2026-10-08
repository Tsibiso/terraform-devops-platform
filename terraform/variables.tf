variable "aws_region" {
  description = "AWS region for the DevOps infrastructure"
  type        = string
  default     = "af-south-1"
}

variable "project_name" {
  description = "Name of the DevOps project"
  type        = string
  default     = "terraform-devops-platform"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}