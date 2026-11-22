# UML diagrams for Bharat Rail ITSM

These diagrams are based on the repository's current Java OOP domain and web application roles. Export as SVG/PNG and **inspect visually** before placing them in the report.

| Diagram | Editable source |
| --- | --- |
| **Formal use case (PlantUML)** | [USE-CASE-DIAGRAM.puml](USE-CASE-DIAGRAM.puml) |
| **Core class diagram (Mermaid)** | [domain-class-diagram.mmd](../java/domain/docs/domain-class-diagram.mmd) |
| **Exceptions/SLA/graph class supplement (Mermaid)** | [domain-class-diagram-extensions.mmd](../java/domain/docs/domain-class-diagram-extensions.mmd) |
| **PostgreSQL ER diagram (Mermaid)** | [ER-DIAGRAM.mmd](ER-DIAGRAM.mmd) |

## Export diagrams locally

**PlantUML use cases** — use the PlantUML VS Code extension, or the official PlantUML Java JAR (installed separately):

`java -jar /path/to/plantuml.jar -tsvg docs/USE-CASE-DIAGRAM.puml`

**Mermaid class diagrams** — use a Mermaid-compatible preview or Mermaid CLI:

`npx @mermaid-js/mermaid-cli -i java/domain/docs/domain-class-diagram.mmd -o class-diagram.svg`

`npx @mermaid-js/mermaid-cli -i java/domain/docs/domain-class-diagram-extensions.mmd -o class-extensions.svg`

The CLI/JAR are authoring tools, not app runtime dependencies. Use a local/trusted tool for your private repository.

## Design accuracy

- `Employee` and `Customer` extend abstract `Reporter`; `Technician` and `Administrator` extend abstract `User` directly.
- `IncidentCategory` is a dynamically configurable **value object** despite living in the Java `enums` package.
- `TransferRequest` in the diagram refers to the **nested** Java record `Incident.TransferRequest`.
- Reporter, service, category, assigned technician and SLA are **associations**. The incident's resolution, audit entries, and pending handover are **owned objects**.
- `NotificationSender` extends `IncidentListener`; the two sender implementations implement `NotificationSender`. This is the **Observer** pattern.
- `PriorityStrategy` and the two `AssignmentStrategy` implementations demonstrate **Strategy**; `IncidentRepository` demonstrates **Repository**.
- `IncidentManagementService` is the example application facade inside `java/domain`. The **live Java HTTP system** is coordinated by `IncidentWorkflowService` in `java/service`. See [ARCHITECTURE.md](ARCHITECTURE.md).
- The impact graph is educational, based on hypothetical dependencies, not a real IRCTC outage monitor.
- The use-case diagram models **actor actions** separately from included automatic classification, priority, SLA, duplicate suggestion, notification and auditing functions. Viewing a ticket is *not* shown as recording an audit mutation.

For a readable report, use the core class diagram on a landscape page and place the supplementary diagram in an appendix. Render the formal PlantUML use case on a separate landscape page. Check that actor symbols, use-case ovals, associations and include arrows are legible.

**Important:** CI verifies Java and TypeScript code, but it does not currently render these UML sources. Export and proofread the final images before submission.
