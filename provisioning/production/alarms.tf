variable "alarm_sns_topic_arns" {
  type        = list(string)
  default     = ["arn:aws:sns:us-east-1:946183545209:HoldRequestConsumerError"]
  description = "SNS topics to notify when a log-based alarm fires"
}

# Will remove once `apply`ed
import {
  to = aws_cloudwatch_metric_alarm.hold_requests_blocked
  id = "CRITICAL - Hold Requests Could Be Blocked!"
}
import {
  to = aws_cloudwatch_log_metric_filter.hold_request_consumer_error
  id = "/aws/lambda/HoldRequestConsumer-production:HoldRequestConsumerError"
}
import {
  to = aws_cloudwatch_metric_alarm.hold_request_consumer_error
  id = "HoldRequestConsumerError"
}

# Error (log with level <= 3) alarm
resource "aws_cloudwatch_log_metric_filter" "hold_request_consumer_error" {
  log_group_name = "/aws/lambda/HoldRequestConsumer-production"
  name           = "HoldRequestConsumerError"
  pattern        = "{ $.levelCode <= 3 }"

  metric_transformation {
    name      = "HoldRequestConsumerError"
    namespace = "LogMetrics"
    unit      = "None"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "hold_request_consumer_error" {
  alarm_name          = "HoldRequestConsumerErrorAlarm"
  alarm_description   = "Alarm for errors coming from the HoldRequestConsumer Lambda"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  metric_name         = "HoldRequestConsumerError"
  namespace           = "LogMetrics"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arns
}


# Iterator age alarm
resource "aws_cloudwatch_metric_alarm" "hold_requests_blocked" {
  alarm_name          = "HoldRequestConsumerIteratorAgeError"
  alarm_description   = "Critical– IteratorAge alarm indicating hold requests could be blocked."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods   = 1
  datapoints_to_alarm  = 1
  metric_name         = "IteratorAge"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1800000
  treat_missing_data  = "missing"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    FunctionName = "HoldRequestConsumer-production"
  }
}

# Lambda invocation errors alarm
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "HoldRequestConsumerLambdaErrorAlarm"
  alarm_description   = "Lambda function HoldRequestConsumer-production has invocation errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    FunctionName = "HoldRequestConsumer-production"
  }
}