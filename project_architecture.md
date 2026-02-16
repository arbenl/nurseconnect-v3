# Project Architecture: NurseConnect v2 Monorepo

This document outlines the proposed project structure and architectural considerations for the `nurseconnect-v3` monorepo. The goal is to establish a clear, scalable, and maintainable setup leveraging modern JavaScript/TypeScript tooling.

## 1. Monorepo Benefits

Utilizing a monorepo approach for `nurseconnect-v3` offers several advantages:
- **Shared Code:** Easily share common utilities, UI components, and type definitions across different applications and packages.
- **Atomic Changes:** Make changes across multiple related projects in a single commit, simplifying coordination and deployment.
- **Consistent Tooling:** Enforce consistent build processes, linting rules, and testing methodologies across the entire codebase.
- **Simplified Dependency Management:** Centralized dependency management with `pnpm` ensures efficient disk space usage and faster installations.

## 2. Core Structure

The monorepo is organized into several key directories:

- **`apps/`**: Contains independent applications that are deployed and run separately.
  - `apps/functions/`: Likely a serverless function application (e.g., Firebase Functions, AWS Lambda) handling backend logic.
  - `apps/web/`: The main web application (e.g., React, Next.js) providing the user interface.

- **`packages/`**: Houses reusable packages that can be consumed by applications or other packages within the monorepo.
  - `packages/contracts/`: Defines shared interfaces, data structures, or API contracts used across the frontend and backend.
  - `packages/testing/`: Contains shared testing utilities, mocks, or test configurations.
  - `packages/tsconfig/`: Centralized TypeScript configurations (`base.json`, `nextjs.json`, `node20.json`) to ensure consistency across all TypeScript projects.
  - `packages/ui/`: A shared UI component library (e.g., React components) to maintain a consistent look and feel.

- **`components/`**: (Potentially for smaller, more granular UI components or shared logic that doesn't warrant a full package).

- **`helpers/`**: General utility functions or helper modules that can be used across different parts of the monorepo.

- **`shared/`**: For code that is broadly shared but might not fit neatly into `packages/` (e.g., constants, enums, common types).

- **`types/`**: Centralized declaration files for global types or external modules.

- **`utilities/`**: Similar to `helpers/`, but potentially for more specialized or domain-specific utility functions.

- **`schemas/`**: Likely contains data validation schemas (e.g., Zod schemas) for API requests/responses or data models.

- **`prompts/`**: Stores prompt templates or configurations, possibly for AI interactions or code generation.

- **`scripts/`**: Contains various utility scripts for development, build, deployment, or maintenance tasks (e.g., `run-phase.sh`).

- **`output/`**: Generated output files, build artifacts, or documentation.

- **`test/`**: Top-level directory for integration or end-to-end tests that span multiple applications/packages.

- **`emulator/`**: Configuration or setup for local emulators (e.g., Firebase Emulator Suite).

## 3. Key Tooling & Configuration

- **`pnpm` (Package Manager)**:
  - **`pnpm-workspace.yaml`**: Defines the workspaces within the monorepo, allowing `pnpm` to manage dependencies and link packages efficiently.
  - **`package.json` (Root)**: Contains monorepo-wide scripts and dependencies.
  - **`package.json` (Workspace)**: Each `app` and `package` has its own `package.json` to declare its specific dependencies and scripts.

- **`Turbo` (Build System)**:
  - **`turbo.json`**: Configures `Turbo` to orchestrate builds, tests, and other tasks across the monorepo. It enables caching and parallel execution for faster development cycles.

- **`TypeScript` (Language)**:
  - **`tsconfig.json` (Root)**: Base TypeScript configuration.
  - **`packages/tsconfig/`**: Centralized and extendable `tsconfig` files (`base.json`, `nextjs.json`, `node20.json`) that are extended by individual `tsconfig.json` files in `apps/` and `packages/`.
  - **`tsconfig.json` (Workspace)**: Each TypeScript project (`app` or `package`) extends from the shared `tsconfig` files, ensuring consistent compiler options.

- **`.gitignore`**: Specifies files and directories to be ignored by Git, including `node_modules`, build outputs, and temporary files.

- **`.env.test`**: Environment variables specific to the test environment.

## 4. Configuration Best Practices

- **Dependency Management**: Always add dependencies to the specific `package.json` of the `app` or `package` that uses them. Use `pnpm add -w <package-name>` for root-level dependencies or `pnpm add <package-name> --filter <workspace-name>` for workspace-specific dependencies.
- **Scripting**: Define common scripts in the root `package.json` and workspace-specific scripts in their respective `package.json` files. Leverage `Turbo` for task orchestration.
- **TypeScript Paths**: Configure `paths` in `tsconfig.json` files to allow absolute imports for internal packages (e.g., `@nurseconnect/contracts`).
- **Linting & Formatting**: Implement consistent linting (e.g., ESLint) and formatting (e.g., Prettier) rules across the entire monorepo, potentially as a shared `package`.
- **Testing**: Define a clear testing strategy, including unit, integration, and end-to-end tests, and configure `Turbo` to run them efficiently.

This architecture provides a solid foundation for developing and maintaining the `nurseconnect-v3` project as a scalable monorepo.