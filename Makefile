#-----------------------------------------
# Variables
#-----------------------------------------
MKFILE_PATH := $(abspath $(lastword ${MAKEFILE_LIST}))
PROJECT_PATH := $(dir ${MKFILE_PATH})

# command name that are also directories
.PHONY:

#-----------------------------------------
# Allow passing arguments to make
#-----------------------------------------
SUPPORTED_COMMANDS := test.unit
SUPPORTS_MAKE_ARGS := $(findstring $(firstword $(MAKECMDGOALS)), $(SUPPORTED_COMMANDS))
ifneq "$(SUPPORTS_MAKE_ARGS)" ""
  COMMAND_ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  $(eval $(COMMAND_ARGS):;@:)
endif

#-----------------------------------------
# Help commands
#-----------------------------------------
.DEFAULT_GOAL := help

help: ## Prints this help
	@grep -E '^[a-zA-Z_\-\0.0-9]+:.*?## .*$$' ${MAKEFILE_LIST} | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'


firebase.login: ## Authenticate the firebase-tools container (persists in the firebase-tools-config volume)
	@docker compose run --rm --workdir "/firebase" firebase-tools firebase login --no-localhost --reauth

firebase.deploy.dev: ## Push firestore rules/indexes to the dev Firebase project
	@docker compose run --rm --workdir "/firebase" firebase-tools firebase deploy -P dev

firebase.deploy.prod: ## Push firestore rules/indexes to the prod Firebase project
	@docker compose run --rm --workdir "/firebase" firebase-tools firebase deploy -P prod

dev: ## Start dev server
	@docker compose up -d
	@echo "Go to http://localhost:3000"

lint: ## Lint
	@docker compose run --rm frontend yarn lint:all

test: ## Run unit tests
	@docker compose run --rm frontend yarn test

stop: ## Stop all services
	@docker compose down
	@echo "✅ All services stopped"
