# Bat Armor: Protection Mechanisms for Free Tier Deployment

## Overview
This document specifies protection mechanisms to safely run the MUD server on OpenShift or AWS Free Tier EC2 while respecting data limits and preventing cost overages.

## Table of Contents
1. [Circuit Breaker Patterns](#circuit-breaker-patterns)
2. [API Rate Limiting & Backoff](#api-rate-limiting--backoff)
3. [Token & Quota Management](#token--quota-management)
4. [CDN & Caching Strategies](#cdn--caching-strategies)
5. [Resource Limits & Monitoring](#resource-limits--monitoring)
6. [Data Transfer Controls](#data-transfer-controls)
7. [Cost Controls](#cost-controls)
8. [Error Handling & Graceful Degradation](#error-handling--graceful-degradation)
9. [Network Configuration & Subdomains](#network-configuration--subdomains)
10. [Current Tooling](#current-tooling)

---

## Circuit Breaker Patterns

### Implementation Strategy
Circuit breakers prevent cascading failures by stopping requests when a service is failing.

### States
- **CLOSED**: Normal operation, requests flow through
- **OPEN**: Service is failing, requests are rejected immediately
- **HALF_OPEN**: Testing if service has recovered, allowing limited requests

### Configuration
```typescript
interface CircuitBreakerConfig {
    failureThreshold: number;      // Open circuit after N failures
    successThreshold: number;       // Close circuit after N successes
    timeout: number;                // Time to wait before trying again (ms)
    resetTimeout: number;           // Time before transitioning to HALF_OPEN
}
```

### Services to Protect
- **AI APIs** (Gemini, OpenAI, Claude)
- **GitHub API**
- **External HTTP requests**
- **Database connections** (if using AWS RDS)

### Implementation Priorities
1. **AI API Circuit Breakers** (High Priority)
   - Prevent quota exhaustion
   - Fail fast when API is down
   - Automatic recovery when service resumes

2. **GitHub API Circuit Breaker**
   - Respect rate limits (5000 requests/hour)
   - Handle secondary rate limits

3. **External Service Circuit Breakers**
   - Weather APIs
   - Third-party services

---

## API Rate Limiting & Backoff

### Current Implementation
- **Token Tracker**: Tracks daily API usage per service
- **File-based storage**: `token-tracker.json`
- **Auto-reset**: Based on refresh period

### Exponential Backoff Strategy
```typescript
interface BackoffConfig {
    initialDelay: number;      // First retry delay (ms)
    maxDelay: number;          // Maximum delay cap (ms)
    multiplier: number;        // Exponential multiplier
    maxRetries: number;         // Maximum retry attempts
    jitter: boolean;           // Add random jitter to prevent thundering herd
}
```

### Rate Limit Headers
Monitor and respect:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After`

### Implementation Tasks
1. **Add Exponential Backoff** to all AI API calls
2. **Respect Rate Limit Headers** from API responses
3. **Queue System** for rate-limited requests
4. **Request Batching** to reduce API calls

### Per-Service Limits

#### Gemini API
- **Free Tier**: 50 requests/day
- **Current**: Tracked in `token-tracker.json`
- **Action**: Already implemented ✓

#### OpenAI API
- **Free Tier**: Varies by plan
- **Current**: Tracked in `token-tracker.json` (200/day limit set)
- **Action**: Already implemented ✓

#### GitHub API
- **Authenticated**: 5000 requests/hour
- **Secondary Rate Limits**: 1000 requests/hour for search
- **Action**: Add rate limit tracking

---

## Token & Quota Management

### Current Tooling
- **TokenTracker Class**: `extensions/mud/src/token-tracker.ts`
- **JSON Storage**: `extensions/mud/data/token-tracker.json`
- **Auto-reset**: Based on refresh period (24 hours default)

### Features
- ✅ Per-service token limits
- ✅ Usage tracking
- ✅ Automatic reset on refresh period
- ✅ Time until reset calculation

### Enhancements Needed
1. **Per-minute/hour limits** (in addition to daily)
2. **Burst protection** (prevent sudden spikes)
3. **Distributed tracking** (for multi-instance deployments)
4. **Alert system** (warn at 80% usage)
5. **Graceful degradation** (fallback to cached responses)

### Migration to AWS
- **DynamoDB**: Store token tracking
- **TTL**: Automatic expiration for daily resets
- **CloudWatch**: Monitor usage patterns

---

## CDN & Caching Strategies

### Static Assets
- **Current**: Served directly from Express static middleware
- **Recommendation**: CloudFront (AWS) or CDN (OpenShift)

### Cache Headers
```typescript
// Static assets (CSS, JS, images)
Cache-Control: public, max-age=31536000, immutable

// API responses (when appropriate)
Cache-Control: public, max-age=300
ETag: "hash-of-content"
```

### Caching Layers

#### 1. Client-Side Caching
- **Browser cache**: Static assets
- **Service Worker**: Offline support
- **LocalStorage**: Token status, user preferences

#### 2. Server-Side Caching
- **Redis/Memcached**: API responses (if available)
- **In-memory cache**: Frequently accessed data
- **File system cache**: Static generated content

#### 3. CDN Caching
- **CloudFront (AWS)**: Global distribution
- **Edge locations**: Reduce origin load
- **Cache invalidation**: On content updates

### Cacheable Resources
- **WiFi scan results**: 5-10 seconds
- **GitHub search results**: 5 minutes
- **AI responses**: Not cacheable (conversation-specific)
- **Static assets**: 1 year (with versioning)

### Implementation Priority
1. **Add cache headers** to static assets
2. **Implement ETags** for API responses
3. **CDN setup** for static files
4. **Redis integration** for API response caching (optional)

---

## Resource Limits & Monitoring

### AWS Free Tier Limits

#### EC2
- **750 hours/month** (t2.micro)
- **1 GB RAM**
- **1 vCPU**
- **Network**: Limited bandwidth

#### Lambda
- **1 million requests/month**
- **400,000 GB-seconds compute**
- **512 MB memory max**

#### DynamoDB
- **25 GB storage**
- **25 read/write units** (on-demand has free tier)

#### S3
- **5 GB storage**
- **20,000 GET requests**
- **2,000 PUT requests**

#### CloudWatch
- **10 custom metrics**
- **5 GB log ingestion**
- **10 alarms**

### OpenShift Limits
- **Resource quotas**: CPU, memory, storage
- **Rate limits**: API requests
- **Network egress**: Bandwidth limits

### Monitoring Strategy

#### Metrics to Track
1. **API Usage**
   - Requests per service
   - Token consumption rate
   - Error rates

2. **Resource Usage**
   - CPU utilization
   - Memory usage
   - Disk I/O
   - Network bandwidth

3. **Cost Metrics**
   - Estimated daily cost
   - Projected monthly cost
   - Alert thresholds

#### Alerts
- **80% quota usage**: Warning
- **90% quota usage**: Critical
- **Resource exhaustion**: Immediate action
- **Cost threshold**: Budget alerts

### Implementation
```typescript
interface ResourceMonitor {
    trackAPICall(service: string, cost: number): void;
    trackMemoryUsage(bytes: number): void;
    trackCPUUsage(percent: number): void;
    checkQuota(service: string): boolean;
    getProjectedCost(): number;
}
```

---

## Data Transfer Controls

### Limits
- **AWS Free Tier**: 1 GB out, 1 GB in (first year)
- **OpenShift**: Varies by plan

### Optimization Strategies

#### 1. Compression
- **Gzip/Brotli**: All text responses
- **Image optimization**: WebP format, compression
- **Minification**: JavaScript, CSS

#### 2. Request Optimization
- **Pagination**: Limit response sizes
- **Field selection**: Only return needed data
- **Batch requests**: Combine multiple API calls

#### 3. Response Optimization
- **Streaming**: For large responses
- **Chunked transfer**: Progressive loading
- **Delta updates**: Only send changes

#### 4. Bandwidth Monitoring
```typescript
interface BandwidthTracker {
    dataIn: number;      // Bytes received
    dataOut: number;    // Bytes sent
    dailyLimit: number; // Daily limit in bytes
    checkLimit(): boolean;
    getUsage(): { in: number; out: number; percent: number };
}
```

### Implementation Tasks
1. **Add compression middleware** (Express)
2. **Monitor bandwidth usage**
3. **Implement response size limits**
4. **Add bandwidth alerts**

---

## Cost Controls

### Cost Tracking
- **Per-service costs**: Track API costs
- **Infrastructure costs**: EC2, storage, data transfer
- **Projected costs**: Estimate monthly spending

### Cost Optimization

#### 1. Resource Scheduling
- **Stop EC2 instances** during off-hours
- **Use Lambda** for sporadic workloads
- **Auto-scaling**: Scale down when not needed

#### 2. Storage Optimization
- **Cleanup old data**: Rotate logs, remove unused files
- **Compression**: Reduce storage needs
- **Lifecycle policies**: Move old data to cheaper storage

#### 3. API Cost Management
- **Cache aggressively**: Reduce API calls
- **Batch requests**: Combine operations
- **Use cheaper models**: When appropriate

### Budget Alerts
```typescript
interface BudgetAlert {
    threshold: number;      // Dollar amount or percentage
    period: 'daily' | 'monthly';
    action: 'warn' | 'block' | 'notify';
}
```

### Implementation
1. **Cost tracking service**
2. **Budget alerts**
3. **Automatic cost controls** (stop services if over budget)
4. **Cost reporting dashboard**

---

## Error Handling & Graceful Degradation

### Error Categories

#### 1. Recoverable Errors
- **Rate limits**: Retry with backoff
- **Temporary failures**: Retry logic
- **Network timeouts**: Retry with exponential backoff

#### 2. Non-Recoverable Errors
- **Quota exceeded**: Stop requests, show user message
- **Authentication failures**: Require user action
- **Invalid requests**: Reject immediately

#### 3. Degradation Strategies
- **Fallback to cached data**: When API unavailable
- **Use cheaper alternatives**: GPT-3.5 instead of GPT-4
- **Reduce functionality**: Disable optional features
- **Queue requests**: Process when quota resets

### Implementation Pattern
```typescript
interface ErrorHandler {
    handleRateLimit(error: Error): Promise<Response | null>;
    handleQuotaExceeded(error: Error): void;
    handleTemporaryFailure(error: Error): Promise<Response | null>;
    shouldRetry(error: Error): boolean;
    getFallbackResponse(request: Request): Response | null;
}
```

### Graceful Degradation Levels
1. **Full functionality**: All services available
2. **Reduced functionality**: Some services disabled
3. **Read-only mode**: Only cached data available
4. **Maintenance mode**: Minimal functionality

---

## Current Tooling

### Implemented

#### Token Tracking
- **File**: `extensions/mud/src/token-tracker.ts`
- **Storage**: `extensions/mud/data/token-tracker.json`
- **Features**: 
  - Per-service limits
  - Auto-reset
  - Usage tracking
  - Time until reset

#### API Key Management
- **File**: `extensions/mud/src/api-key-loader.ts`
- **Features**:
  - Load from file or environment
  - Environment variables take precedence
  - Multiple path support

#### Error Handling
- **Gemini**: Quota error detection and user-friendly messages
- **OpenAI**: Quota error detection (just added)
- **GitHub**: Basic error handling

### Missing / To Implement

#### Circuit Breakers
- ❌ No circuit breaker implementation
- **Priority**: High
- **Use Case**: AI API protection

#### Exponential Backoff
- ❌ No retry logic with backoff
- **Priority**: High
- **Use Case**: Rate limit recovery

#### Rate Limit Headers
- ❌ Not parsing or respecting rate limit headers
- **Priority**: Medium
- **Use Case**: Better quota management

#### Caching
- ❌ No response caching
- **Priority**: Medium
- **Use Case**: Reduce API calls and costs

#### Resource Monitoring
- ❌ No resource usage tracking
- **Priority**: Medium
- **Use Case**: Prevent overages

#### Bandwidth Tracking
- ❌ No data transfer monitoring
- **Priority**: Low
- **Use Case**: Stay within free tier limits

#### Cost Tracking
- ❌ No cost estimation or alerts
- **Priority**: Low
- **Use Case**: Budget management

---

## Implementation Roadmap

### Phase 1: Critical Protection (Pre-Deployment)
1. ✅ Token tracking (Done)
2. ✅ Error handling improvements (Done)
3. ⏳ Circuit breakers for AI APIs
4. ⏳ Exponential backoff for retries
5. ⏳ Rate limit header parsing

### Phase 2: Optimization (Post-Deployment)
1. ⏳ Response caching (Redis or in-memory)
2. ⏳ Resource monitoring
3. ⏳ Bandwidth tracking
4. ⏳ Cost estimation

### Phase 3: Advanced Features (Future)
1. ⏳ Distributed token tracking (DynamoDB)
2. ⏳ Auto-scaling based on usage
3. ⏳ Advanced cost controls
4. ⏳ Predictive quota management

---

## AWS Migration Checklist

### Pre-Migration
- [ ] Audit current resource usage
- [ ] Estimate AWS costs
- [ ] Set up AWS free tier account
- [ ] Configure billing alerts

### Migration Steps
- [ ] Move token tracking to DynamoDB
- [ ] Set up CloudFront for CDN
- [ ] Configure CloudWatch monitoring
- [ ] Set up S3 for file storage
- [ ] Implement Lambda functions (if needed)
- [ ] Configure auto-scaling policies

### Post-Migration
- [ ] Verify all protections working
- [ ] Monitor costs daily
- [ ] Set up alerts
- [ ] Document operational procedures

---

## OpenShift Considerations

### Resource Quotas
- CPU limits
- Memory limits
- Storage limits
- Network egress limits

### Protection Mechanisms
- **HPA** (Horizontal Pod Autoscaler): Auto-scale based on metrics
- **Resource quotas**: Prevent resource exhaustion
- **Limit ranges**: Default resource limits
- **Network policies**: Control traffic

### Implementation
- Configure resource requests and limits
- Set up HPA for automatic scaling
- Monitor resource usage
- Implement graceful shutdown

---

## Network Configuration & Subdomains

### AWS Subdomain Configuration

#### Route53 DNS Setup

**Free Tier**: 50 hosted zones, 1 million queries/month

##### Step 1: Create Hosted Zone
```bash
# Create hosted zone for your domain
aws route53 create-hosted-zone \
  --name example.com \
  --caller-reference $(date +%s)
```

##### Step 2: Update Name Servers
- Copy the 4 name servers from Route53 hosted zone
- Update your domain registrar's name servers
- Wait for DNS propagation (can take 24-48 hours)

##### Step 3: Create Subdomain Records

**A Record (IPv4)**
```bash
# Create A record pointing to EC2 instance
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "mud.example.com",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": "1.2.3.4"}]
      }
    }]
  }'
```

**CNAME Record (for Elastic IP or Load Balancer)**
```json
{
  "Name": "api.example.com",
  "Type": "CNAME",
  "TTL": 300,
  "ResourceRecords": [{"Value": "ec2-1-2-3-4.compute-1.amazonaws.com"}]
}
```

**Wildcard Subdomain**
```json
{
  "Name": "*.example.com",
  "Type": "A",
  "TTL": 300,
  "ResourceRecords": [{"Value": "1.2.3.4"}]
}
```

##### Step 4: Health Checks (Optional)
```bash
# Create health check for subdomain
aws route53 create-health-check \
  --caller-reference $(date +%s) \
  --health-check-config '{
    "Type": "HTTP",
    "ResourcePath": "/health",
    "FullyQualifiedDomainName": "mud.example.com",
    "RequestInterval": 30,
    "FailureThreshold": 3
  }'
```

#### EC2 Subnet Configuration

##### Subnet Best Practices

**1. Multi-AZ Deployment (High Availability)**
```
Public Subnet (us-east-1a):
  - EC2 Instance (Primary)
  - Internet Gateway
  - Route Table: 0.0.0.0/0 → IGW

Public Subnet (us-east-1b):
  - EC2 Instance (Backup)
  - Internet Gateway
  - Route Table: 0.0.0.0/0 → IGW

Private Subnet (us-east-1a):
  - RDS (if needed)
  - Route Table: 0.0.0.0/0 → NAT Gateway
```

**2. Free Tier Considerations**
- Use single Availability Zone to save costs
- Single public subnet is sufficient for free tier
- Avoid NAT Gateway ($0.045/hour) - use public subnet with security groups

**3. Security Group Configuration**

**Web Server Security Group**
```json
{
  "InboundRules": [
    {
      "Protocol": "TCP",
      "Port": 80,
      "Source": "0.0.0.0/0",
      "Description": "HTTP"
    },
    {
      "Protocol": "TCP",
      "Port": 443,
      "Source": "0.0.0.0/0",
      "Description": "HTTPS"
    },
    {
      "Protocol": "TCP",
      "Port": 3001,
      "Source": "0.0.0.0/0",
      "Description": "MUD Server"
    },
    {
      "Protocol": "TCP",
      "Port": 22,
      "Source": "YOUR_IP/32",
      "Description": "SSH (restrict to your IP)"
    }
  ],
  "OutboundRules": [
    {
      "Protocol": "-1",
      "Destination": "0.0.0.0/0",
      "Description": "All outbound"
    }
  ]
}
```

**4. Elastic IP (Free for EC2)**

```bash
# Allocate Elastic IP
aws ec2 allocate-address --domain vpc

# Associate with EC2 instance
aws ec2 associate-address \
  --instance-id i-1234567890abcdef0 \
  --allocation-id eipalloc-1234567890abcdef0
```

**Benefits**:
- Free when attached to running instance
- Static IP for DNS records
- Survives instance stop/start

**5. VPC Configuration (Free Tier)**

**Minimal VPC Setup**:
```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16

# Create Internet Gateway
aws ec2 create-internet-gateway
aws ec2 attach-internet-gateway \
  --vpc-id vpc-1234567890abcdef0 \
  --internet-gateway-id igw-1234567890abcdef0

# Create Public Subnet
aws ec2 create-subnet \
  --vpc-id vpc-1234567890abcdef0 \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a

# Create Route Table
aws ec2 create-route-table --vpc-id vpc-1234567890abcdef0
aws ec2 create-route \
  --route-table-id rtb-1234567890abcdef0 \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id igw-1234567890abcdef0
```

**6. Subnet Tricks & Tips**

**Cost Optimization**:
- Use single AZ to avoid cross-AZ data transfer costs
- Public subnet only (no NAT Gateway needed for free tier)
- Use security groups instead of NACLs for simplicity

**Network Isolation**:
- Separate subnets for different environments (dev/staging/prod)
- Use route tables to control traffic flow
- Security groups for application-level filtering

**Monitoring**:
- Enable VPC Flow Logs (free tier: 100 GB/month)
- Monitor Elastic IP usage
- Track subnet IP address utilization

#### Application Load Balancer (ALB) - Optional

**Free Tier**: Not included, but useful for production

**Benefits**:
- Health checks and automatic failover
- SSL termination
- Path-based routing

**Configuration**:
```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name mud-alb \
  --subnets subnet-12345678 subnet-87654321 \
  --security-groups sg-1234567890abcdef0

# Create target group
aws elbv2 create-target-group \
  --name mud-targets \
  --protocol HTTP \
  --port 3001 \
  --vpc-id vpc-1234567890abcdef0 \
  --health-check-path /health

# Register targets
aws elbv2 register-targets \
  --target-group-arn arn:aws:elasticloadbalancing:... \
  --targets Id=i-1234567890abcdef0
```

**Route53 → ALB**:
```json
{
  "Name": "mud.example.com",
  "Type": "A",
  "AliasTarget": {
    "HostedZoneId": "Z35SXDOTRQ7X7K",
    "DNSName": "mud-alb-123456789.us-east-1.elb.amazonaws.com",
    "EvaluateTargetHealth": true
  }
}
```

---

### OpenShift Subdomain Configuration

#### OpenShift Router & Routes

**Default Router**: Automatically created, uses wildcard DNS

##### Step 1: Create Route

**Basic Route (HTTP)**
```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: mud-server
  namespace: mud-production
spec:
  host: mud.example.com
  to:
    kind: Service
    name: mud-server
    weight: 100
  port:
    targetPort: 3001
  wildcardPolicy: None
```

**Secure Route (HTTPS)**
```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: mud-server-secure
  namespace: mud-production
spec:
  host: mud.example.com
  to:
    kind: Service
    name: mud-server
    weight: 100
  port:
    targetPort: 3001
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
    certificate: |
      -----BEGIN CERTIFICATE-----
      ...
      -----END CERTIFICATE-----
    key: |
      -----BEGIN PRIVATE KEY-----
      ...
      -----END PRIVATE KEY-----
```

**Passthrough Route (Full TLS)**
```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: mud-server-passthrough
spec:
  host: mud.example.com
  to:
    kind: Service
    name: mud-server
  tls:
    termination: passthrough
```

##### Step 2: External DNS Configuration

**For Custom Domain**:

1. **Get Router IP/URL**:
```bash
# Get router hostname
oc get route -n default router -o jsonpath='{.status.ingress[0].host}'

# Or get router service IP
oc get svc -n default router -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

2. **Create DNS Record**:
   - **A Record**: Point to router IP
   - **CNAME Record**: Point to router hostname
   - **Wildcard**: `*.apps.your-cluster.com` → router IP

**Example DNS Records**:
```
Type    Name                    Value
A       mud.example.com         1.2.3.4 (router IP)
CNAME   api.example.com         router-default.apps.your-cluster.com
A       *.example.com           1.2.3.4 (router IP)
```

##### Step 3: Multiple Routes (Subdomains)

**Route 1: Main API**
```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: mud-api
spec:
  host: api.example.com
  to:
    kind: Service
    name: mud-server
  port:
    targetPort: 3001
```

**Route 2: WebSocket**
```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: mud-websocket
spec:
  host: ws.example.com
  to:
    kind: Service
    name: mud-server
  port:
    targetPort: 3001
```

**Route 3: Admin Interface**
```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: mud-admin
spec:
  host: admin.example.com
  to:
    kind: Service
    name: mud-admin
  port:
    targetPort: 8080
```

#### OpenShift Network Policies

##### Network Isolation

**Allow Ingress from Router Only**:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-router-ingress
  namespace: mud-production
spec:
  podSelector:
    matchLabels:
      app: mud-server
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: default
      podSelector:
        matchLabels:
          router: "true"
    ports:
    - protocol: TCP
      port: 3001
```

**Allow Inter-Pod Communication**:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-pod-communication
  namespace: mud-production
spec:
  podSelector:
    matchLabels:
      app: mud-server
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: mud-client
    ports:
    - protocol: TCP
      port: 3001
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: mud-database
    ports:
    - protocol: TCP
      port: 5432
```

**Deny All (Default) + Allow Specific**:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-default
  namespace: mud-production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  # No rules = deny all
```

#### OpenShift Subnet Considerations

##### Cluster Network Configuration

**SDN (Software Defined Network) Options**:

1. **OVS (OpenVSwitch) - Default**
   - Single flat network
   - All pods can communicate
   - Simple but less secure

2. **OVS Multitenant** (Deprecated)
   - Project-level isolation
   - Network isolation between projects
   - Being replaced by Network Policies

3. **OVS Network Policy**
   - NetworkPolicy-based isolation
   - Fine-grained control
   - Recommended for production

**Network Configuration**:
```yaml
# Cluster Network Operator config
apiVersion: config.openshift.io/v1
kind: Network
metadata:
  name: cluster
spec:
  clusterNetwork:
  - cidr: 10.128.0.0/14
    hostPrefix: 23
  serviceNetwork:
  - 172.30.0.0/16
  networkType: OVNKubernetes
```

##### Service Network

**Service IP Range**: `172.30.0.0/16` (default)

**Service Types**:
```yaml
# ClusterIP (default)
apiVersion: v1
kind: Service
metadata:
  name: mud-server
spec:
  type: ClusterIP
  ports:
  - port: 3001
    targetPort: 3001
  selector:
    app: mud-server

# NodePort (accessible from outside)
apiVersion: v1
kind: Service
metadata:
  name: mud-server-nodeport
spec:
  type: NodePort
  ports:
  - port: 3001
    targetPort: 3001
    nodePort: 30001

# LoadBalancer (cloud provider)
apiVersion: v1
kind: Service
metadata:
  name: mud-server-lb
spec:
  type: LoadBalancer
  ports:
  - port: 3001
    targetPort: 3001
```

##### Subnet Tricks & Tips

**1. Resource Limits**
- Each pod gets IP from pod CIDR
- Monitor IP address exhaustion
- Increase `hostPrefix` if needed (more IPs per node)

**2. Network Policies**
- Start with default-deny
- Add explicit allow rules
- Test policies in dev namespace first

**3. Route Sharding**
- Multiple routers for different subdomains
- Distribute load across routers
- Use annotations for route selection

```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: mud-server
  annotations:
    route.openshift.io/termination: "edge"
    haproxy.router.openshift.io/balance: roundrobin
spec:
  host: mud.example.com
  ...
```

**4. Route Timeouts**
```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: mud-websocket
  annotations:
    haproxy.router.openshift.io/timeout: 300s
    haproxy.router.openshift.io/websocket: "true"
spec:
  host: ws.example.com
  ...
```

**5. Path-Based Routing**
```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: mud-api-v1
spec:
  host: api.example.com
  path: /api/v1
  to:
    kind: Service
    name: mud-api-v1
---
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: mud-api-v2
spec:
  host: api.example.com
  path: /api/v2
  to:
    kind: Service
    name: mud-api-v2
```

**6. Weighted Routing (Blue/Green)**
```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: mud-server
spec:
  host: mud.example.com
  to:
    kind: Service
    name: mud-server-blue
    weight: 90
  alternateBackends:
  - kind: Service
    name: mud-server-green
    weight: 10
```

#### DNS Configuration for OpenShift

##### External DNS (Route53, Cloudflare, etc.)

**Option 1: External DNS Operator**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: external-dns-config
data:
  config.yaml: |
    provider: route53
    aws:
      region: us-east-1
    domain-filter: example.com
    txt-owner-id: openshift-cluster-1
```

**Option 2: Manual DNS Updates**
```bash
# Get route hostname
ROUTE_HOST=$(oc get route mud-server -o jsonpath='{.status.ingress[0].host}')

# Create CNAME record pointing to OpenShift route
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"mud.example.com\",
        \"Type\": \"CNAME\",
        \"TTL\": 300,
        \"ResourceRecords\": [{\"Value\": \"$ROUTE_HOST\"}]
      }
    }]
  }"
```

##### Wildcard DNS

**OpenShift Default Pattern**:
- `*.apps.your-cluster.com` → Router IP
- All routes automatically get subdomain

**Custom Wildcard**:
```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: mud-wildcard
spec:
  host: "*.example.com"
  to:
    kind: Service
    name: mud-server
  wildcardPolicy: Subdomain
```

**DNS Setup**:
```
Type    Name          Value
A       *.example.com 1.2.3.4 (router IP)
```

---

### Security Considerations

#### AWS Security

**1. Security Groups**
- Restrict SSH (port 22) to your IP only
- Use least privilege principle
- Separate security groups for different tiers

**2. Network ACLs (Optional)**
- Additional layer of security
- Stateless (unlike security groups)
- Use for subnet-level rules

**3. VPC Flow Logs**
- Monitor all network traffic
- Detect anomalies
- Free tier: 100 GB/month

**4. AWS WAF (Web Application Firewall)**
- Protect against common attacks
- Rate limiting
- Not in free tier, but useful for production

#### OpenShift Security

**1. Network Policies**
- Implement default-deny
- Add explicit allow rules
- Test thoroughly before production

**2. Route Security**
- Always use HTTPS (TLS termination)
- Use valid SSL certificates
- Enable HSTS headers

**3. Service Mesh (Istio/Service Mesh)**
- Advanced traffic management
- mTLS between services
- Not in free tier, but powerful

**4. Egress Policies**
- Control outbound traffic
- Block access to unnecessary services
- Whitelist required external APIs

---

### Cost Optimization

#### AWS

**Free Tier Eligible**:
- ✅ Route53: 50 hosted zones, 1M queries/month
- ✅ Elastic IP: Free when attached to running instance
- ✅ VPC: Free (basic VPC features)
- ✅ Security Groups: Free
- ❌ NAT Gateway: $0.045/hour (avoid for free tier)
- ❌ Load Balancer: ~$16/month (avoid for free tier)

**Tips**:
- Use single AZ deployment
- Public subnet only (no NAT Gateway)
- Elastic IP for static DNS records
- Use Route53 health checks (free)

#### OpenShift

**Free Tier Considerations**:
- Routes are free (no additional cost)
- Network policies are free
- Service mesh may cost extra (check provider)

**Tips**:
- Use default router (free)
- Multiple routes per service (no extra cost)
- Network policies for security (free)
- Monitor resource quotas

---

### Troubleshooting

#### AWS

**DNS Not Resolving**:
1. Check Route53 hosted zone
2. Verify name servers in domain registrar
3. Wait for DNS propagation (use `dig` or `nslookup`)
4. Check TTL settings

**Cannot Reach EC2 Instance**:
1. Verify security group rules
2. Check route table (0.0.0.0/0 → IGW)
3. Verify Elastic IP association
4. Check instance status

#### OpenShift

**Route Not Accessible**:
1. Check route status: `oc get route`
2. Verify service exists: `oc get svc`
3. Check pod labels match service selector
4. Verify router is running: `oc get pods -n default -l router=true`

**Network Policy Blocking Traffic**:
1. List network policies: `oc get networkpolicies`
2. Check policy rules
3. Verify pod labels match selectors
4. Test with `oc exec` to debug

---

## Best Practices

### 1. Fail Fast
- Check limits before making requests
- Validate inputs early
- Reject requests that will definitely fail

### 2. Cache Aggressively
- Cache API responses when possible
- Use ETags for conditional requests
- Implement stale-while-revalidate

### 3. Monitor Everything
- Track all API calls
- Monitor resource usage
- Alert on anomalies

### 4. Graceful Degradation
- Always have a fallback
- Don't break the entire system for one failure
- Provide user feedback

### 5. Cost Awareness
- Track costs continuously
- Set budgets and alerts
- Optimize before costs spiral

---

## Emergency Procedures

### Quota Exceeded
1. **Immediate**: Stop all API calls to affected service
2. **Short-term**: Enable circuit breaker, show user message
3. **Long-term**: Wait for quota reset, optimize usage

### Resource Exhaustion
1. **CPU/Memory**: Scale down non-essential services
2. **Storage**: Clean up old data, compress files
3. **Network**: Enable compression, reduce payload sizes

### Cost Overrun
1. **Immediate**: Stop all billable services
2. **Assess**: Review usage patterns
3. **Optimize**: Reduce costs before resuming

---

## Testing Strategy

### Unit Tests
- Circuit breaker state transitions
- Token tracking accuracy
- Backoff calculation
- Error handling paths

### Integration Tests
- API rate limit handling
- Quota exhaustion scenarios
- Resource limit enforcement
- Cost calculation accuracy

### Load Tests
- Concurrent request handling
- Rate limit compliance
- Resource usage under load
- Cost projection accuracy

---

## Documentation

### Code Comments
- Document all protection mechanisms
- Explain configuration options
- Provide usage examples

### Operational Runbooks
- How to handle quota exceeded
- How to recover from failures
- How to monitor costs
- How to scale resources

---

## Conclusion

This armor provides multi-layered protection:
1. **Circuit breakers** prevent cascading failures
2. **Rate limiting** prevents quota exhaustion
3. **Caching** reduces API calls and costs
4. **Monitoring** provides early warning
5. **Graceful degradation** maintains service availability

With these protections in place, the MUD server can safely operate on free tier infrastructure while providing excellent user experience.

---

## References

- [AWS Free Tier Limits](https://aws.amazon.com/free/)
- [OpenShift Resource Limits](https://docs.openshift.com/)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)
- [Rate Limiting Best Practices](https://cloud.google.com/apis/design/rate_limiting)

