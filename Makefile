.PHONY: dev seed logs stop clean migrate

dev:
	docker-compose up --build

dev-detach:
	docker-compose up --build -d

seed:
	docker-compose exec backend python seed.py

logs:
	docker-compose logs -f

stop:
	docker-compose down

clean:
	docker-compose down -v --remove-orphans

migrate:
	docker-compose exec backend alembic upgrade head

shell-backend:
	docker-compose exec backend bash

shell-db:
	docker-compose exec db psql -U gatepass gatepass
