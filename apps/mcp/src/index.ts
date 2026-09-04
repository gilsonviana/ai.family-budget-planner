#!/usr/bin/env node

import { fileURLToPath } from "node:url";

import {
  BillQueryService,
  AiPeriodSummaryService,
  BudgetInsightService,
  BudgetForecastService,
  BudgetSummaryService,
  ExpensePlanService,
  ExpenseProjectionService,
  FamilyMemberService,
  FamilyProfileService,
  IncomePlanService,
  IncomeProjectionService,
  PeriodComparisonService,
  buildAnalyticalBreakdowns,
} from "@family-finance/application";
import {
  loadApplicationConfig,
  type ApplicationConfig,
} from "@family-finance/config";
import {
  initializeDatabase,
  SQLiteBillPlanRepository,
  SQLiteExpenseCategoryRepository,
  SQLiteExpensePlanRepository,
  SQLiteFamilyMemberRepository,
  SQLiteFamilyProfileRepository,
  SQLiteIncomePlanRepository,
  OpenAILlmProvider,
  budgetInsightValidator,
  type FinanceDatabase,
} from "@family-finance/infrastructure";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPlanningTools, type ToolRegistrar } from "./planning-tools.js";
import { registerAnalyticsTools } from "./analytics-tools.js";
import { registerInsightTools } from "./insight-tools.js";

export const mcpPackageName = "@family-finance/mcp";
export const mcpVersion = "0.0.0";

interface ServerBoundary {
  close(): Promise<void>;
  connect(transport: TransportBoundary): Promise<void>;
}
interface TransportBoundary {
  onerror?: (error: Error) => void;
}
interface DatabaseBoundary {
  readonly database?: FinanceDatabase;
  close(): void;
}
export interface McpRuntimeDependencies {
  createDatabase(path: string): DatabaseBoundary;
  createServer(
    config: ApplicationConfig,
    database: DatabaseBoundary,
  ): ServerBoundary;
  createTransport(): TransportBoundary;
  reportError(message: string): void;
}

const migrationsFolder = fileURLToPath(
  new URL("../../../packages/infrastructure/drizzle/", import.meta.url),
);

export class FinanceMcpRuntime {
  private closed = false;
  constructor(
    private readonly server: ServerBoundary,
    private readonly transport: TransportBoundary,
    private readonly database: { close(): void },
    private readonly reportError: (message: string) => void,
  ) {}
  async start(): Promise<void> {
    this.transport.onerror = (error) => {
      this.reportError(`MCP protocol error: ${error.message}`);
    };
    await this.server.connect(this.transport);
  }
  async shutdown(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.server.close();
    this.database.close();
  }
}

function defaultDependencies(): McpRuntimeDependencies {
  return {
    createDatabase: (path) => initializeDatabase(path, migrationsFolder),
    createServer: (_config, initialized) => {
      if (!initialized.database)
        throw new Error("Finance database was not initialized");
      const families = new SQLiteFamilyProfileRepository(initialized.database);
      const members = new SQLiteFamilyMemberRepository(initialized.database);
      const incomes = new SQLiteIncomePlanRepository(initialized.database);
      const categories = new SQLiteExpenseCategoryRepository(
        initialized.database,
      );
      const expenses = new SQLiteExpensePlanRepository(initialized.database);
      const incomeService = new IncomePlanService(families, members, incomes);
      const incomeProjections = new IncomeProjectionService(families, incomes);
      const expenseProjections = new ExpenseProjectionService(
        families,
        expenses,
      );
      const summaries = new BudgetSummaryService(
        incomeProjections,
        expenseProjections,
      );
      const server = new McpServer({
        name: "family-finance",
        version: mcpVersion,
      });
      registerPlanningTools(server as unknown as ToolRegistrar, {
        bills: new BillQueryService(
          new SQLiteBillPlanRepository(initialized.database),
        ),
        expenses: new ExpensePlanService(families, categories, expenses),
        families: new FamilyProfileService(families),
        incomes: incomeService,
        members: new FamilyMemberService(families, members, {
          hasReferences: (familyId, memberId) =>
            incomeService.hasMemberReferences(familyId, memberId),
        }),
      });
      registerAnalyticsTools(server as unknown as ToolRegistrar, {
        analytics: {
          analyze: async (familyId, period) => {
            const [income, expense, categoryList, memberList] =
              await Promise.all([
                incomeProjections.project(familyId, period),
                expenseProjections.project(familyId, period),
                categories.list(familyId),
                members.listByFamilyId(familyId),
              ]);
            return buildAnalyticalBreakdowns(
              income,
              expense,
              categoryList,
              memberList,
            );
          },
        },
        comparisons: new PeriodComparisonService(summaries),
        forecasts: new BudgetForecastService(
          incomeProjections,
          expenseProjections,
        ),
        summaries,
      });
      registerInsightTools(
        server as unknown as ToolRegistrar,
        _config.llm
          ? new AiPeriodSummaryService(
              summaries,
              {
                analyze: async (familyId, period) => {
                  const [income, expense, categoryList, memberList] =
                    await Promise.all([
                      incomeProjections.project(familyId, period),
                      expenseProjections.project(familyId, period),
                      categories.list(familyId),
                      members.listByFamilyId(familyId),
                    ]);
                  return buildAnalyticalBreakdowns(
                    income,
                    expense,
                    categoryList,
                    memberList,
                  );
                },
              },
              new BudgetInsightService(
                new OpenAILlmProvider(_config),
                budgetInsightValidator,
              ),
            )
          : undefined,
      );
      return server as unknown as ServerBoundary;
    },
    createTransport: () => new StdioServerTransport(),
    reportError: (message) => process.stderr.write(`${message}\n`),
  };
}

export async function startMcpServer(
  environment: Readonly<Record<string, string | undefined>> = process.env,
  dependencies: McpRuntimeDependencies = defaultDependencies(),
): Promise<FinanceMcpRuntime> {
  const config = loadApplicationConfig(environment);
  const database = dependencies.createDatabase(config.database.path);
  const runtime = new FinanceMcpRuntime(
    dependencies.createServer(config, database),
    dependencies.createTransport(),
    database,
    dependencies.reportError,
  );
  try {
    await runtime.start();
    return runtime;
  } catch (error) {
    await runtime.shutdown();
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    const runtime = await startMcpServer();
    const shutdown = () =>
      void runtime.shutdown().finally(() => process.exit(0));
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "MCP server startup failed"}\n`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === new URL(process.argv[1], "file:").href
) {
  void main();
}
