#!/bin/bash
set -ex
aws ecr create-repository --repository-name bilingual-chatbot
docker build -t bilingual-chatbot .
docker tag bilingual-chatbot:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/bilingual-chatbot:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/bilingual-chatbot:latest