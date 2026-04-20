# Makefile (root)
# Usage:
#   make plan TASK=1-auth-roles AGENT=dev
#   make plan-all TASK=1-auth-roles
#   make apply PLAN=output/1-auth-roles/DEV.plan.json
#   make full-phase TASK=1-auth-roles

TASK ?= 1-auth-roles
AGENT ?= dev

plan:
	node scripts/agent-runner.mjs $(AGENT) $(TASK)

plan-all:
	node scripts/agent-runner.mjs dev $(TASK)
	node scripts/agent-runner.mjs qa $(TASK)
	node scripts/agent-runner.mjs security $(TASK)
	node scripts/agent-runner.mjs ops $(TASK)
	node scripts/agent-runner.mjs ux $(TASK)
	node scripts/agent-runner.mjs perf $(TASK)

apply:
	@if [ -z "$(PLAN)" ]; then echo "Specify PLAN=output/<task>/<AGENT>.plan.json"; exit 1; fi
	node scripts/apply-plan.mjs $(PLAN)

apply-dry:
	@if [ -z "$(PLAN)" ]; then echo "Specify PLAN=output/<task>/<AGENT>.plan.json"; exit 1; fi
	node scripts/apply-plan.mjs $(PLAN) --dry-run

full-phase:
	make plan-all TASK=$(TASK)
	node scripts/apply-plan.mjs output/$(TASK)/DEV.plan.json
	node scripts/apply-plan.mjs output/$(TASK)/SECURITY.plan.json
	node scripts/apply-plan.mjs output/$(TASK)/OPS.plan.json
	node scripts/apply-plan.mjs output/$(TASK)/QA.plan.json --dry-run
	echo "✅ Full phase pipeline prepared."
