#!/usr/bin/env bash
# ==============================================================================
# SilverPoint POD - Production Deployment & Continuous Update Script
# ==============================================================================
set -e

echo ">>> [1/5] Pulling latest commits from GitHub..."
git pull origin main

echo ">>> [2/5] Building production containers..."
docker compose -f docker-compose.prod.yml build

echo ">>> [3/5] Starting services with automated migrations..."
docker compose -f docker-compose.prod.yml up -d

echo ">>> [4/5] Pruning orphaned docker build layers..."
docker image prune -f

echo ">>> [5/5] Checking container health..."
docker compose -f docker-compose.prod.yml ps

echo "======================================================"
echo "  SilverPoint POD Successfully Deployed Live!"
echo "======================================================"
