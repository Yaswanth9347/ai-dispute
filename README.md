# AI Dispute Resolver

A full-stack project for legal-aid assistance in low-value civil disputes in India.  
It uses a Next.js frontend and an Express/Supabase/GenAI backend.

---

## Project Structure

```
.
├── backend/    # Node.js Express API, Supabase, GenAI integration
├── frontend/   # Next.js 15 React frontend
├── sql/        # Supabase schema SQL
├── Document/   # Sample documents (PDFs)
├── test.py     # Example Python script for Google GenAI
```

---

## Getting Started

### 1. Clone the repository

```sh
git clone https://github.com/yourusername/ai-dispute-resolver.git
cd ai-dispute-resolver
```

### 2. Setup Environment Variables

- Copy `.env.example` to `.env` and fill in required values.
- For backend: copy `backend/.env.example` to `backend/.env` and set your Supabase/GenAI keys.
- For frontend: copy `frontend/.env.example` to `frontend/.env.local` if needed.

### 3. Install Dependencies

**Backend:**
```sh
cd backend
pnpm install
```

**Frontend:**
```sh
cd frontend
pnpm install
```

### 4. Database

- Use the schema in [`sql/supabase_schema.sql`](sql/supabase_schema.sql) to set up your Supabase database.

### 5. Run the Project

**Backend:**
```sh
cd backend
pnpm dev
```

**Frontend:**
```sh
cd frontend
pnpm dev
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:8080](http://localhost:8080)

---

## Technologies Used

- **Frontend:** Next.js 15, React 19, Tailwind CSS
- **Backend:** Express.js, Supabase, Google GenAI
- **Database:** Supabase (PostgreSQL)
- **Other:** pnpm, dotenv

---

## License

MIT

---

## Notes

- Do **not** commit your `.env` files or any secrets.
- For deployment, see the frontend and backend `README.md` files for more details.