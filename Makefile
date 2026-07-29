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


firebase.deploy: ## Push configuration to firebase
	@docker compose run --rm --workdir "/firebase" firebase-tools firebase deploy

firebase.emulators: ## Start firebase emulators (auth + firestore)
	@docker compose run --rm --workdir "/firebase" -p 4000:4000 -p 8080:8080 -p 9099:9099 firebase-tools firebase emulators:start

dev: ## Start dev server
	@docker compose up -d
	@echo "Go to http://127.0.0.1:3000"

lint: ## Lint
	@docker compose run --rm frontend yarn lint:all

test: ## Run unit tests
	@docker compose run --rm frontend yarn test

pwa.build: ## Build PWA for production
	@echo "Building PWA for production..."
	@docker compose -f pwa-test/docker-compose.yml --profile build run --rm build
	@echo "✅ PWA built successfully in ./dist"

pwa.serve: pwa.build ## Build and serve PWA locally for testing
	@echo "Starting PWA server..."
	@docker compose -f pwa-test/docker-compose.yml --profile pwa up -d pwa
	@echo "✅ PWA server started at http://127.0.0.1:4173"
	@echo ""
	@echo "🔧 PWA Testing URLs:"
	@echo "   Main app: http://127.0.0.1:4173"
	@echo "   Service Worker: http://127.0.0.1:4173/service-rotation/sw.js"
	@echo "   Manifest: http://127.0.0.1:4173/service-rotation/manifest.webmanifest"
	@echo ""
	@echo "📱 To test PWA features:"
	@echo "   1. Open Chrome DevTools > Application > Service Workers"
	@echo "   2. Check 'Update on reload' and 'Bypass for network'"
	@echo "   3. Test offline functionality by going offline in Network tab"
	@echo "   4. Test install prompt (Chrome > ⋮ > Install)"

pwa.stop: ## Stop PWA server
	@docker compose -f pwa-test/docker-compose.yml --profile pwa down
	@echo "✅ PWA server stopped"

pwa.test: ## Test PWA functionality
	@echo "🔍 Testing PWA functionality..."
	@docker run --rm -v $(PWD):/app --network host node:22-alpine node /app/pwa-test/test-pwa.js

pwa.lighthouse: ## Test PWA with lighthouse (requires Chrome/Chromium)
	@echo "🔍 Testing PWA with Lighthouse..."
	@echo "Make sure PWA server is running (make pwa.serve)"
	@docker run --rm --network host node:22-alpine sh -c "npx lighthouse http://127.0.0.1:4173 --only-categories=pwa --chrome-flags='--headless' --output=json --output-path=/tmp/lighthouse.json && cat /tmp/lighthouse.json"

pwa.clean: ## Clean PWA build artifacts
	@rm -rf ./dist
	@echo "✅ PWA build artifacts cleaned"

stop: pwa.stop ## Stop all services
	@docker compose down
	@echo "✅ All services stopped"
