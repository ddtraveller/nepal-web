#!/bin/bash
set -ex
aws ecr create-repository --repository-name bilingual-chatbot
docker build -t bilingual-chatbot .
docker tag bilingual-chatbot:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/bilingual-chatbot:latest
#  aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 874956223356.dkr.ecr.us-west-2.amazonaws.com
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/bilingual-chatbot:latest