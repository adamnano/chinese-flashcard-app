.PHONY: setup seed dev test stop

PYTHON := backend/.venv/bin/python
PIP    := backend/.venv/bin/pip

# One-time setup: create venv, install dependencies, seed vocabulary data
setup:
	@echo "==> Starting PostgreSQL..."
	docker compose up -d postgres
	@echo "==> Waiting for Postgres to be ready..."
	@until docker compose exec postgres pg_isready -U flashcard -d flashcards > /dev/null 2>&1; do sleep 1; done
	@echo "==> Creating Python virtual environment..."
	python3 -m venv backend/.venv
	@echo "==> Installing Python dependencies..."
	$(PIP) install -r backend/requirements.txt
	@echo "==> Installing Node dependencies..."
	cd frontend && npm install
	@echo "==> Seeding HSK and TOCFL data..."
	$(MAKE) seed
	@echo ""
	@echo "Setup complete! Run 'make dev' to start the app."

# Seed vocabulary reference data (safe to re-run)
seed:
	cd backend && ../.venv/bin/python -m app.seed.seed_hsk 2>/dev/null || $(PYTHON) -m app.seed.seed_hsk
	cd backend && ../.venv/bin/python -m app.seed.seed_tocfl 2>/dev/null || $(PYTHON) -m app.seed.seed_tocfl

# Start both backend and frontend with live reload
dev:
	@echo "==> Starting PostgreSQL..."
	docker compose up -d postgres
	@trap 'kill 0' INT; \
	  cd backend && ../.venv/bin/uvicorn app.main:app --reload --port 8000 & \
	  cd frontend && npm run dev & \
	  wait

# Run backend unit tests
test:
	cd backend && ../.venv/bin/python -m pytest tests/ -v

# Stop Postgres
stop:
	docker compose stop
