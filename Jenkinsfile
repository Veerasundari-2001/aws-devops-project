pipeline {
    agent any

    environment {
        AWS_REGION     = 'us-east-1'
        ECR_REPO       = '521223133955.dkr.ecr.us-east-1.amazonaws.com/devops-demo-app'
        ECS_CLUSTER    = 'devops-project-cluster'
        ECS_SERVICE    = 'devops-demo-app-service'
        IMAGE_TAG      = "${env.BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Test') {
            steps {
                dir('app') {
                    sh 'npm install'
                    sh 'npm test'
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                dir('app') {
                    sh "docker build -t ${ECR_REPO}:${IMAGE_TAG} -t ${ECR_REPO}:latest ."
                }
            }
        }

        stage('Push to ECR') {
            steps {
                sh """
                  aws ecr get-login-password --region ${AWS_REGION} | \
                  docker login --username AWS --password-stdin ${ECR_REPO}
                  docker push ${ECR_REPO}:${IMAGE_TAG}
                  docker push ${ECR_REPO}:latest
                """
            }
        }

        stage('Deploy to ECS') {
            steps {
                sh """
                  aws ecs update-service \
                    --cluster ${ECS_CLUSTER} \
                    --service ${ECS_SERVICE} \
                    --force-new-deployment \
                    --region ${AWS_REGION}
                """
            }
        }
    }

    post {
        success { echo 'Deployment succeeded!' }
        failure { echo 'Pipeline failed — check logs above.' }
    }
}