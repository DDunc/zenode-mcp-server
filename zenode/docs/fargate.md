# AWS Fargate ECS Deployment Plan for Zenode MCP Server

## Overview
This document outlines a comprehensive deployment strategy for the Zenode MCP Server on AWS Fargate using ECS (Elastic Container Service). This plan ensures scalability, reliability, and security for production workloads.

## Architecture Components

### 1. Container Registry (ECR)
- **Repository**: `zenode-mcp-server`
- **Image tagging strategy**: `latest`, `v1.x.x`, `staging`
- **Lifecycle policy**: Keep last 10 production images

### 2. ECS Cluster Configuration
```json
{
  "clusterName": "zenode-mcp-cluster",
  "capacityProviders": ["FARGATE", "FARGATE_SPOT"],
  "defaultCapacityProviderStrategy": [
    {
      "capacityProvider": "FARGATE",
      "weight": 1,
      "base": 1
    },
    {
      "capacityProvider": "FARGATE_SPOT", 
      "weight": 4,
      "base": 0
    }
  ]
}
```

### 3. Task Definition
```json
{
  "family": "zenode-mcp-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/zenodeTaskRole",
  "containerDefinitions": [
    {
      "name": "zenode-mcp",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/zenode-mcp-server:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "LOG_LEVEL", "value": "info"},
        {"name": "REDIS_URL", "value": "redis://zenode-redis.cache.amazonaws.com:6379/0"}
      ],
      "secrets": [
        {"name": "OPENAI_API_KEY", "valueFrom": "/zenode/prod/openai-api-key"},
        {"name": "OPENROUTER_API_KEY", "valueFrom": "/zenode/prod/openrouter-api-key"},
        {"name": "GOOGLE_API_KEY", "valueFrom": "/zenode/prod/google-api-key"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/zenode-mcp",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### 4. Service Configuration
```json
{
  "serviceName": "zenode-mcp-service",
  "cluster": "zenode-mcp-cluster",
  "taskDefinition": "zenode-mcp-task",
  "desiredCount": 2,
  "launchType": "FARGATE",
  "platformVersion": "LATEST",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-12345", "subnet-67890"],
      "securityGroups": ["sg-zenode-mcp"],
      "assignPublicIp": "ENABLED"
    }
  },
  "loadBalancers": [
    {
      "targetGroupArn": "arn:aws:elasticloadbalancing:REGION:ACCOUNT:targetgroup/zenode-tg",
      "containerName": "zenode-mcp",
      "containerPort": 3000
    }
  ],
  "serviceRegistries": [
    {
      "registryArn": "arn:aws:servicediscovery:REGION:ACCOUNT:service/srv-zenode"
    }
  ]
}
```

## Infrastructure Setup

### 1. VPC and Networking
```bash
# Create VPC with public/private subnets
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=zenode-vpc}]'

# Create subnets in multiple AZs
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.2.0/24 --availability-zone us-east-1b
```

### 2. Security Groups
```bash
# Create security group for Zenode MCP
aws ec2 create-security-group \
  --group-name zenode-mcp-sg \
  --description "Security group for Zenode MCP Server" \
  --vpc-id vpc-xxx

# Allow HTTP traffic
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxx \
  --protocol tcp \
  --port 3000 \
  --source-group sg-alb-xxx
```

### 3. Application Load Balancer
```json
{
  "Name": "zenode-alb",
  "Scheme": "internet-facing",
  "Type": "application",
  "IpAddressType": "ipv4",
  "Subnets": ["subnet-12345", "subnet-67890"],
  "SecurityGroups": ["sg-alb-zenode"],
  "Tags": [
    {"Key": "Environment", "Value": "production"},
    {"Key": "Service", "Value": "zenode-mcp"}
  ]
}
```

### 4. Redis (ElastiCache)
```json
{
  "CacheClusterId": "zenode-redis",
  "Engine": "redis",
  "CacheNodeType": "cache.t3.micro",
  "NumCacheNodes": 1,
  "VpcSecurityGroupIds": ["sg-redis-zenode"],
  "SubnetGroupName": "zenode-cache-subnet-group",
  "Port": 6379,
  "ParameterGroupName": "default.redis7"
}
```

## Environment Variables and Secrets

### 1. AWS Systems Manager Parameter Store
```bash
# Store API keys securely
aws ssm put-parameter \
  --name "/zenode/prod/openai-api-key" \
  --value "sk-..." \
  --type "SecureString" \
  --description "OpenAI API key for Zenode MCP"

aws ssm put-parameter \
  --name "/zenode/prod/openrouter-api-key" \
  --value "sk-..." \
  --type "SecureString" \
  --description "OpenRouter API key for Zenode MCP"

aws ssm put-parameter \
  --name "/zenode/prod/google-api-key" \
  --value "..." \
  --type "SecureString" \
  --description "Google API key for Zenode MCP"
```

### 2. Environment Configuration
```bash
# Production environment variables
NODE_ENV=production
LOG_LEVEL=info
REDIS_URL=redis://zenode-redis.cache.amazonaws.com:6379/0
DEFAULT_MODEL=anthropic/claude-sonnet-4-20250514
HEALTH_CHECK_PATH=/health
PORT=3000
```

## Auto Scaling Configuration

### 1. Service Auto Scaling
```json
{
  "ServiceNamespace": "ecs",
  "ResourceId": "service/zenode-mcp-cluster/zenode-mcp-service",
  "ScalableDimension": "ecs:service:DesiredCount",
  "MinCapacity": 2,
  "MaxCapacity": 10,
  "RoleARN": "arn:aws:iam::ACCOUNT:role/application-autoscaling-ecs-service"
}
```

### 2. Scaling Policies
```json
{
  "PolicyName": "zenode-scale-up",
  "PolicyType": "TargetTrackingScaling",
  "TargetTrackingScalingPolicyConfiguration": {
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleOutCooldown": 300,
    "ScaleInCooldown": 300
  }
}
```

## Monitoring and Logging

### 1. CloudWatch Logs
```bash
# Create log group
aws logs create-log-group --log-group-name /ecs/zenode-mcp

# Set retention policy
aws logs put-retention-policy \
  --log-group-name /ecs/zenode-mcp \
  --retention-in-days 30
```

### 2. CloudWatch Metrics and Alarms
```json
{
  "AlarmName": "zenode-high-cpu",
  "AlarmDescription": "Zenode MCP high CPU utilization",
  "ActionsEnabled": true,
  "AlarmActions": ["arn:aws:sns:REGION:ACCOUNT:zenode-alerts"],
  "MetricName": "CPUUtilization",
  "Namespace": "AWS/ECS",
  "Statistic": "Average",
  "Dimensions": [
    {"Name": "ServiceName", "Value": "zenode-mcp-service"},
    {"Name": "ClusterName", "Value": "zenode-mcp-cluster"}
  ],
  "Period": 300,
  "EvaluationPeriods": 2,
  "Threshold": 80.0,
  "ComparisonOperator": "GreaterThanThreshold"
}
```

### 3. Application Performance Monitoring
```javascript
// Add to zenode application
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

// Custom metrics
const putMetric = (metricName, value, unit = 'Count') => {
  const params = {
    Namespace: 'Zenode/MCP',
    MetricData: [{
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date()
    }]
  };
  cloudwatch.putMetricData(params).promise();
};
```

## Security Configuration

### 1. IAM Roles
```json
{
  "RoleName": "zenodeTaskRole",
  "AssumeRolePolicyDocument": {
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  },
  "Policies": [
    {
      "PolicyName": "ZenodeSSMAccess",
      "PolicyDocument": {
        "Version": "2012-10-17",
        "Statement": [{
          "Effect": "Allow",
          "Action": [
            "ssm:GetParameter",
            "ssm:GetParameters",
            "ssm:GetParametersByPath"
          ],
          "Resource": "arn:aws:ssm:*:*:parameter/zenode/*"
        }]
      }
    }
  ]
}
```

### 2. Network Security
- Use private subnets for ECS tasks
- Configure NAT Gateway for outbound internet access
- Implement WAF rules for the ALB
- Enable VPC Flow Logs for network monitoring

## Deployment Pipeline

### 1. CI/CD with GitHub Actions
```yaml
name: Deploy to AWS Fargate
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
          
      - name: Build and push image
        run: |
          aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
          docker build -t zenode-mcp .
          docker tag zenode-mcp:latest $ECR_REGISTRY/zenode-mcp-server:latest
          docker push $ECR_REGISTRY/zenode-mcp-server:latest
          
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster zenode-mcp-cluster \
            --service zenode-mcp-service \
            --force-new-deployment
```

### 2. Blue/Green Deployment
```bash
# Create new task definition revision
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Update service with new task definition
aws ecs update-service \
  --cluster zenode-mcp-cluster \
  --service zenode-mcp-service \
  --task-definition zenode-mcp-task:REVISION
```

## Cost Optimization

### 1. Fargate Spot Instances
- Use 80% Fargate Spot for non-critical workloads
- Maintain 20% regular Fargate for baseline capacity
- Implement graceful shutdown handling

### 2. Reserved Capacity (for predictable workloads)
- Consider Savings Plans for consistent usage
- Use Compute Savings Plans for 1-3 year commitments

### 3. Resource Right-Sizing
```bash
# Monitor resource utilization
aws logs filter-log-events \
  --log-group-name /ecs/zenode-mcp \
  --filter-pattern "CPU Memory" \
  --start-time $(date -d '1 day ago' +%s)000
```

## Disaster Recovery

### 1. Multi-Region Setup
- Primary: us-east-1
- Secondary: us-west-2
- Cross-region ECR replication
- Redis backup and restore procedures

### 2. Backup Strategy
```bash
# Redis backup
aws elasticache create-snapshot \
  --cache-cluster-id zenode-redis \
  --snapshot-name zenode-backup-$(date +%Y%m%d)

# Parameter store backup
aws ssm get-parameters-by-path \
  --path "/zenode/" \
  --recursive \
  --with-decryption > zenode-params-backup.json
```

## Implementation Checklist

### Phase 1: Infrastructure Setup
- [ ] Create VPC and networking components
- [ ] Set up ECR repository
- [ ] Create ECS cluster
- [ ] Configure security groups
- [ ] Set up ElastiCache Redis

### Phase 2: Application Deployment
- [ ] Create task definition
- [ ] Configure secrets in Parameter Store
- [ ] Deploy ECS service
- [ ] Set up Application Load Balancer
- [ ] Configure target groups

### Phase 3: Monitoring and Security
- [ ] Set up CloudWatch logging
- [ ] Create monitoring dashboards
- [ ] Configure alarms and notifications
- [ ] Implement auto-scaling policies
- [ ] Security hardening

### Phase 4: CI/CD and Operations
- [ ] Set up deployment pipeline
- [ ] Configure blue/green deployments
- [ ] Implement health checks
- [ ] Document runbooks
- [ ] Disaster recovery testing

## Estimated Costs (Monthly)

- **Fargate**: $50-150 (depending on scale)
- **ElastiCache Redis**: $15-30
- **Application Load Balancer**: $25
- **NAT Gateway**: $45
- **Data Transfer**: $10-50
- **CloudWatch**: $5-15

**Total estimated cost**: $150-315/month for production workload

## Support and Maintenance

### 1. Monitoring Checklist
- Monitor service health and availability
- Track resource utilization metrics
- Monitor application-specific metrics
- Review security logs and alerts

### 2. Regular Maintenance
- Update container images with security patches
- Review and rotate API keys
- Update task definitions with new configurations
- Performance tuning based on metrics

### 3. Troubleshooting
```bash
# Common debugging commands
aws ecs describe-services --cluster zenode-mcp-cluster --services zenode-mcp-service
aws ecs describe-tasks --cluster zenode-mcp-cluster --tasks TASK_ARN
aws logs tail /ecs/zenode-mcp --follow
```

This comprehensive deployment plan provides a production-ready foundation for running the Zenode MCP Server on AWS Fargate with proper scaling, monitoring, and security configurations.