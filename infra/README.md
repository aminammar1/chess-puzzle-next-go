# EKS Dev CI/CD Guide

This repository now includes:

- Terraform for AWS API Gateway integration only (EKS is existing): `infra/terraform/environments/dev`
- Kubernetes manifests for all services: `infra/k8s/base` and `infra/k8s/overlays/dev`
- GitHub Actions workflows:
  - `.github/workflows/ci.yml`
  - `.github/workflows/build-push-ghcr.yml`
  - `.github/workflows/deploy-dev-eks.yml`
  - `.github/workflows/infra-dev.yml`

## GitHub Environment: `dev`

Use a GitHub Environment named `dev`.

For `.github/workflows/deploy-dev-eks.yml`, define these environment secrets:

- `EKS_CERTIFICATE_AUTHORITY`
- `EKS_CLUSTER_IAM_ROLE_ARN`
- `EKS_OIDC_PROVIDER_URL`
- `EKS_SERVER_ENDPOINT`

For `.github/workflows/infra-dev.yml` (Terraform API Gateway), only `EKS_CLUSTER_IAM_ROLE_ARN` is required for AWS authentication.

Recommended environment variable:

- `DEV_API_BACKEND_URL`: public `api-gateway` LoadBalancer DNS URL used by Terraform for API Gateway integration.

If you already have an EKS cluster (for example `eks-chess-app`), you can deploy workloads first with `.github/workflows/deploy-dev-eks.yml`, then read the `api-gateway` service hostname and set `DEV_API_BACKEND_URL`.

If you do not need AWS API Gateway, Terraform is optional. You can use the `api-gateway` EKS LoadBalancer URL directly.

## Container Images (GHCR)

Images are pushed to:

- `ghcr.io/<owner>/chess-puzzle-next-go/client:<tag>`
- `ghcr.io/<owner>/chess-puzzle-next-go/api-gateway:<tag>`
- `ghcr.io/<owner>/chess-puzzle-next-go/puzzle-generator:<tag>`
- `ghcr.io/<owner>/chess-puzzle-next-go/voice-to-move:<tag>`

Default deployment tag is `dev-latest`.

## Deployment Order

1. Run image publish workflow `.github/workflows/build-push-ghcr.yml`.
2. Run deployment workflow `.github/workflows/deploy-dev-eks.yml` (default cluster name is `eks-chess-app`).
3. Get `api-gateway` service hostname (`kubectl get svc api-gateway -n dev -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'`) and set `DEV_API_BACKEND_URL` to `http://<hostname>`.
4. Run Terraform workflow `.github/workflows/infra-dev.yml` with `action=apply` to wire AWS API Gateway to that backend URL.

Note: Terraform no longer creates EKS resources in this repository.

## Kubernetes Workloads

Deployed in namespace `dev`:

- `client` (Next.js)
- `api-gateway` (nginx)
- `puzzle-generator` (Go)
- `voice-to-move` (FastAPI)
- `redis`

EKS Auto Mode exposes `api-gateway` via a `LoadBalancer` service.
EKS Auto Mode also exposes `client` via a public `LoadBalancer` service.

## Optional Runtime Secrets for Services

The manifests support optional secret references:

- `puzzle-generator-secrets`
- `voice-to-move-secrets`

Create them in namespace `dev` if needed:

```bash
kubectl create secret generic puzzle-generator-secrets -n dev --from-literal=OPENROUTER_API_KEY=... --from-literal=HUGGINGFACE_TOKEN=...
kubectl create secret generic voice-to-move-secrets -n dev --from-literal=OPENAI_API_KEY=... --from-literal=ASSEMBLYAI_API_KEY=...
```
