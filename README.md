# AWS DevOps CI/CD Pipeline Project

An end-to-end CI/CD pipeline that automatically builds, tests, containerizes, and deploys a Node.js web app to AWS ECS Fargate — triggered by a Jenkins pipeline whenever code is pushed to GitHub.

## Architecture

```
GitHub (source)
    │  push
    ▼
Jenkins (EC2)
    │  1. Checkout code
    │  2. npm install & test
    │  3. docker build
    │  4. Push image → Amazon ECR
    │  5. Force new deployment → ECS
    ▼
Amazon ECS (Fargate) ── behind ── Application Load Balancer ── Internet
    │
    ▼
CloudWatch Logs
```

**Infrastructure provisioned with Terraform:** VPC (public + private subnets), NAT Gateway, Application Load Balancer, ECS Cluster (Fargate), ECR repository, IAM roles, CloudWatch log group.

## Tech Stack

| Layer | Tool |
|---|---|
| Source control | GitHub |
| CI/CD orchestration | Jenkins (self-hosted on EC2) |
| Containerization | Docker |
| Image registry | Amazon ECR |
| Infrastructure as Code | Terraform |
| Container orchestration | Amazon ECS (Fargate) |
| Load balancing | Application Load Balancer |
| Runtime | Node.js 20 + Express |
| Logging | Amazon CloudWatch Logs |

## Repository Structure

```
aws-devops-project/
├── Jenkinsfile          # CI/CD pipeline definition
├── app/
│   ├── package.json
│   ├── server.js
│   └── Dockerfile
└── infra/
    └── main.tf           # Terraform: VPC, ECR, ECS, ALB
```

## How It Works

1. A developer pushes code to the `main` branch on GitHub.
2. Jenkins picks up the change (via manual **Build Now** or a configured webhook).
3. The pipeline runs through five stages: **Checkout → Test → Build Docker Image → Push to ECR → Deploy to ECS**.
4. ECS pulls the new image and performs a rolling deployment with zero downtime, behind the ALB.
5. The updated app is live at the ALB's public DNS name within a couple of minutes of the push.

## Setup Guide

### Prerequisites
- AWS account with an IAM user (access keys configured locally, or via `~/.aws/credentials`)
- AWS CLI v2
- Terraform v1.5+
- Docker
- Git + a GitHub account with a personal access token (`repo` scope)

### 1. Clone and inspect the app
```bash
git clone https://github.com/<your-username>/aws-devops-project.git
cd aws-devops-project
```

### 2. Provision AWS infrastructure
```bash
cd infra
terraform init
terraform plan
terraform apply
```
Note the two outputs — `ecr_repo_url` and `alb_dns_name` — you'll need the ECR URL for the Jenkinsfile and the ALB DNS name to test the deployed app.

### 3. Launch and configure Jenkins (EC2)
- Launch an EC2 instance (t2.medium or larger — Jenkins needs it) in a public subnet from the VPC above.
- Security group: allow inbound TCP 22 (SSH/Instance Connect) and TCP 8080 (Jenkins UI), both restricted to your IP.
- Attach an IAM instance role with `AmazonEC2ContainerRegistryFullAccess` **and** `AmazonECS_FullAccess` — both are required; Jenkins needs the ECR permission to push images and the ECS permission to trigger deployments.

Install dependencies on the instance:
```bash
sudo yum update -y
sudo yum install -y docker git unzip

sudo systemctl enable docker --now
sudo usermod -aG docker ec2-user

# Java 21 is required for current Jenkins releases
sudo yum install -y java-21-amazon-corretto
sudo alternatives --config java   # select the java-21 option

# Node.js (needed for npm install/test in the pipeline)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Jenkins
sudo wget -O /etc/yum.repos.d/jenkins.repo https://pkg.jenkins.io/redhat-stable/jenkins.repo
sudo rpm --import https://pkg.jenkins.io/redhat-stable/jenkins.io-2023.key
sudo yum install -y jenkins
sudo systemctl enable jenkins --now
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

Get the initial admin password and finish setup in the browser:
```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```
Visit `http://<instance-public-ip>:8080`, unlock Jenkins, install suggested plugins, create an admin user.

**Plugins used:** Amazon ECR, Docker Pipeline, GitHub Integration, Pipeline: AWS Steps.

### 4. Create the Jenkins pipeline job
- New Item → **Pipeline** → name it `devops-demo-pipeline`
- Pipeline → **Pipeline script from SCM** → Git → your repo URL → Script Path: `Jenkinsfile`
- If the repo is private, add credentials (GitHub username + personal access token) under Manage Jenkins → Credentials

### 5. Update the Jenkinsfile with your ECR URL
Edit the `ECR_REPO` value in `Jenkinsfile` to match your Terraform output, then push:
```bash
git add Jenkinsfile
git commit -m "Configure ECR repo URL"
git push
```

### 6. Run the pipeline
Jenkins → your job → **Build Now**. Watch the five stages complete, then check the app:
```bash
curl http://<alb_dns_name>
```

## Troubleshooting Notes (from building this)

- **Jenkins fails to start with a Java version error** → recent Jenkins releases require Java 21, not 17. Install `java-21-amazon-corretto` and switch to it with `alternatives --config java`.
- **`npm: command not found` in the Test stage** → Node.js isn't installed on the Jenkins EC2 instance by default; install it separately from Jenkins itself.
- **`AccessDeniedException` on `ecs:UpdateService`** → the IAM role attached to the EC2 instance is missing `AmazonECS_FullAccess`. Both ECR and ECS policies must be attached to the same role.
- **Site unreachable on port 8080** → almost always a missing inbound security group rule for TCP 8080, not a Jenkins problem.

## Known Limitations / Not Yet Implemented

This build focused on getting the core CI/CD loop working end-to-end. The following were intentionally left out and are good next steps:

- **Monitoring & alerting** — no CloudWatch alarms or SNS notifications are configured yet. The ECS service and ALB metrics are visible in CloudWatch by default, but nothing actively alerts on high CPU, failed deployments, etc.
- **Security hardening** — the IAM role/user in use has broad permissions (`AmazonECS_FullAccess`, `AmazonEC2ContainerRegistryFullAccess`) rather than least-privilege scoped policies. Jenkins' port 8080 should be restricted further in a real deployment, and secrets (if added later, e.g. a database password) should move to AWS Secrets Manager rather than environment variables in the Jenkinsfile.

## Cleanup

To avoid ongoing AWS charges:
```bash
cd infra
terraform destroy
```
Then manually terminate the Jenkins EC2 instance and confirm no orphaned NAT Gateways, Elastic IPs, or ECR images remain in the AWS console.

## Author

Built as a hands-on learning project to practice CI/CD, containerization, and infrastructure-as-code on AWS.