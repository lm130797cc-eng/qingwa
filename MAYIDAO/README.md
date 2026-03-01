# MAYIDAO - Ant Island AI Ecosystem

Welcome to the **MAYIDAO** platform repository. This structure is designed for deployment on the TRAE Agent Platform.

## 📂 Directory Structure

- **`00_SYSTEM_PROMPTS`**: Contains the core persona and directives for the System Commander at different growth phases.
  - `phase1_survival`: MVP launch, manual fallback.
  - `phase2_automation`: Automated payments & referrals.
  - `phase3_scaling`: High concurrency & microservices.
  - `phase4_ecosystem`: Open platform & API.

- **`01_AGENTS_CONFIG`**: YAML configurations for individual agents.
  - `gateway_agent`: Routes traffic.
  - `referral_agent`: Manages user growth.
  - `payment_agent`: Handles transactions.
  - `monitor_agent`: Ensures system health.

- **`02_FRONTEND`**: Lightweight Mobile-First H5 Application.
  - Single Page Application (SPA) architecture.
  - New Chinese Aesthetic UI.

- **`03_BACKEND`**: Serverless functions (Cloudflare Workers compatible).
  - `api_gateway.js`: Entry point.
  - `report_bridge.js`: Connects to existing Python core.
  - `referral_core.js`: Loyalty logic.

- **`04_DATABASE`**: SQL Schema for Supabase (PostgreSQL).
  - Users, Orders, Referrals tables.

- **`05_COMPLIANCE`**: Legal & Safety.
  - Disclaimers in ZH/EN.
  - Regional compliance rules.

## 🚀 Deployment Instructions

1. **Load System Prompt**: Select the appropriate phase prompt from `00_SYSTEM_PROMPTS` in TRAE.
2. **Configure Agents**: Load YAML configs into the agent orchestration layer.
3. **Deploy Frontend**: Upload `02_FRONTEND` to a static host (Vercel/Netlify).
4. **Connect Backend**: Deploy `03_BACKEND` to Cloudflare Workers or similar runtime.
5. **Initialize DB**: Run `schema.sql` in your Supabase project.

## ⚠️ Important Note
This system is a **simulation** of traditional wisdom using AI technology. Always include the "Entertainment Only" disclaimer.
