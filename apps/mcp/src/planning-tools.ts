import {
  RepositoryNotFoundError,
  type BillQueryService,
  type ExpensePlanService,
  type FamilyMemberService,
  type FamilyProfileService,
  type IncomePlanService,
} from "@family-finance/application";
import { z } from "zod";

export interface PlanningToolServices {
  readonly bills: BillQueryService;
  readonly expenses: ExpensePlanService;
  readonly families: FamilyProfileService;
  readonly incomes: IncomePlanService;
  readonly members: FamilyMemberService;
}
type ToolResult = {
  readonly content: readonly [{ readonly text: string; readonly type: "text" }];
  readonly isError?: boolean;
};
export interface ToolRegistrar {
  registerTool(
    name: string,
    definition: {
      readonly description: string;
      readonly inputSchema: z.ZodType;
      readonly title: string;
    },
    handler: (input: unknown) => Promise<ToolResult>,
  ): void;
}

function text(value: unknown): ToolResult {
  return {
    content: [
      {
        text: JSON.stringify(value, (_key, item) =>
          typeof item === "bigint" ? item.toString() : item,
        ),
        type: "text",
      },
    ],
  };
}
async function safely<T>(operation: () => Promise<T>): Promise<ToolResult> {
  try {
    return text(await operation());
  } catch (error) {
    const code =
      error instanceof z.ZodError
        ? "INVALID_ARGUMENT"
        : error instanceof RepositoryNotFoundError
          ? "NOT_FOUND"
          : "INTERNAL_ERROR";
    const message =
      code === "INTERNAL_ERROR"
        ? "The planning operation failed"
        : error instanceof Error
          ? error.message
          : "Invalid request";
    return { ...text({ error: { code, message } }), isError: true };
  }
}

const familyId = z.string().trim().min(1).max(128);
const entityId = z.string().trim().min(1).max(128);
const familyCreateSchema = z
  .object({
    id: entityId,
    name: z.string().trim().min(1).max(120),
    currency: z.string().length(3),
    locale: z.string().min(2),
    timeZone: z.string().min(1),
    weekStartsOn: z.number().int().min(0).max(6),
  })
  .strict();

export function registerPlanningTools(
  server: ToolRegistrar,
  services: PlanningToolServices,
): void {
  const definitions = [
    {
      name: "family_create",
      title: "Create family",
      description: "Create a household and its financial settings.",
      schema: familyCreateSchema,
      run: (input: z.infer<typeof familyCreateSchema>) =>
        services.families.create({
          id: input.id,
          name: input.name,
          settings: {
            currency: input.currency,
            locale: input.locale,
            timeZone: input.timeZone,
            weekStartsOn: input.weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          },
        }),
    },
  ] as const;
  for (const definition of definitions)
    server.registerTool(
      definition.name,
      {
        description: definition.description,
        inputSchema: definition.schema,
        title: definition.title,
      },
      (input) => safely(() => definition.run(definition.schema.parse(input))),
    );

  register(
    server,
    "family_get",
    "Get family",
    "Read one household.",
    z.object({ familyId }).strict(),
    (input) => services.families.get(input.familyId),
  );
  register(
    server,
    "member_add",
    "Add family member",
    "Add a member to a household.",
    z
      .object({
        familyId,
        id: entityId,
        name: z.string().trim().min(1).max(120),
      })
      .strict(),
    (input) => services.members.add(input),
  );
  register(
    server,
    "member_list",
    "List family members",
    "List household members.",
    z.object({ familyId }).strict(),
    (input) => services.members.list(input.familyId),
  );
  register(
    server,
    "income_list",
    "List income plans",
    "List expected income plans.",
    z
      .object({
        familyId,
        memberId: entityId.optional(),
        active: z.boolean().optional(),
      })
      .strict(),
    (input) =>
      services.incomes.list({
        familyId: input.familyId,
        ...(input.memberId === undefined ? {} : { memberId: input.memberId }),
        ...(input.active === undefined ? {} : { active: input.active }),
      }),
  );
  register(
    server,
    "expense_list",
    "List expense plans",
    "List planned expenses.",
    z
      .object({
        familyId,
        categoryId: entityId.optional(),
        active: z.boolean().optional(),
      })
      .strict(),
    (input) =>
      services.expenses.list({
        familyId: input.familyId,
        ...(input.categoryId === undefined
          ? {}
          : { categoryId: input.categoryId }),
        ...(input.active === undefined ? {} : { active: input.active }),
      }),
  );
  register(
    server,
    "bill_get",
    "Get bill",
    "Read a configured bill and its reminder settings.",
    z.object({ familyId, id: entityId }).strict(),
    (input) => services.bills.get(input.familyId, input.id),
  );
}

function register<T extends z.ZodType>(
  server: ToolRegistrar,
  name: string,
  title: string,
  description: string,
  schema: T,
  run: (input: z.infer<T>) => Promise<unknown>,
): void {
  server.registerTool(
    name,
    { description, inputSchema: schema, title },
    (input) => safely(() => run(schema.parse(input))),
  );
}
