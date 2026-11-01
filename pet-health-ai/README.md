# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## Run the pet health model

The `/check` page sends the selected image to the FastAPI model in `model/main.py`.

1. Create and activate a Python virtual environment, then install dependencies:

   ```powershell
   cd model
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

2. Start the API from the `model` directory with `python main.py`. The first start downloads the CLIP guardrail model, so it needs internet access. The API listens at `http://127.0.0.1:8000`.

3. In another terminal, start the frontend from the project root with `npm run dev`.

The default API URL is `http://127.0.0.1:8000`. Copy `.env.example` to `.env.local` to override it, then restart Vite. Analysis requires the API to be running; the page does not return sample predictions.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
