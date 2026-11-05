# React + Vite

## Login / Sign-up prototype

เปิด `/#/login` หรือ `/#/signup` หรือกดไอคอนบัญชีผู้ใช้ด้านขวาของเมนู

- ใช้โหมดจำลองเสมอ เนื่องจากยังไม่มี API สำหรับบัญชีผู้ใช้ ไม่เกี่ยวกับ `VITE_API_URL` ของโมเดลวิเคราะห์ภาพ
- Login รับอีเมลที่มีรูปแบบถูกต้องและรหัสผ่านที่ไม่ว่าง ส่วน Sign-up ต้องมีชื่อ รหัสผ่านอย่างน้อย 8 ตัวอักษร และยืนยันรหัสผ่านตรงกัน
- ไม่ได้สร้างบัญชีจริง และไม่ตรวจรหัสผ่านเทียบฐานข้อมูล ไม่ส่งหรือเก็บรหัสผ่าน
- เก็บเฉพาะชื่อ อีเมล และสถานะ `mock` ใน `sessionStorage` หากเลือกจดจำฉันไว้จะใช้ `localStorage` ออกจากระบบได้ที่ไอคอนบัญชีผู้ใช้
- ลืมรหัสผ่านเป็นขั้นตอนจำลอง ไม่มีการส่งอีเมลจริง
- ก่อนเปิดใช้บัญชีจริง ต้องแทนที่ mock session ด้วย API และการจัดการ session ที่ backend

## PostgreSQL database design

See [แบบฐานข้อมูล PostgreSQL (ภาษาไทย)](database/README.th.md) for the table design, ER diagram, integration plan, and setup commands. The initial schema is in `database/001_initial_schema.sql`, with the six model classes in `database/002_seed_classes.sql`. These files do not connect the running API to a database yet.

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
