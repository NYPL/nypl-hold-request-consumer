# Will remove once `apply`ed
import {
  to = module.base.aws_cloudwatch_metric_alarm.hold_requests_blocked
  id = "CRITICAL - Hold Requests Could Be Blocked!"
}
import {
  to = module.base.aws_cloudwatch_log_metric_filter.hold_request_consumer_error
  id = "/aws/lambda/HoldRequestConsumer-production:HoldRequestConsumerError"
}
import {
  to = module.base.aws_cloudwatch_metric_alarm.hold_request_consumer_error_alarm
  id = "HoldRequestConsumerError"
}
