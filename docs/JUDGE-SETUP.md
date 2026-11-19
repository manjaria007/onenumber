# Judge setup (draft — finalise before submission)

1. **Install** OneNumber with the installation link on the Devpost page. Choose your site, approve Jira, then add Confluence when prompted.
2. **Create demo content.** Either:
   - run `npm run seed` from this repo with your site details in `.env` (see README), or
   - create one Confluence page per definition using [the template](metric-definition-template.md), add the label `metric-definition`, and create a Jira issue that mentions "churn".
3. Open **Jira → Apps → OneNumber Metric Health**, press **Rescan Confluence**, and enter a project key for reconcile tasks.
   - **Expected:** Churn rate and Net revenue show as *disputed* (high impact); Active customers shows as *trusted*.
4. Open the Jira request *"Q4 board deck: churn is 4.1%…"*.
   - **Expected:** the OneNumber panel warns about conflicting churn definitions: 90 vs 30 days, trial accounts excluded vs included.
5. Press **Ask the data team to reconcile**.
   - **Expected:** a new task in your reconcile project, linked to the request, listing every difference and definition page.
6. In Confluence, open *"Q4 board deck — KPI summary (draft)"*.
   - **Expected:** the OneNumber byline item flags the disputed metrics.
   - Insert the **OneNumber metric card** macro with metric `Churn rate`.
7. In **Rovo chat**, choose **Metric Steward** and ask *"Why are Finance and Marketing reporting different churn?"*.
   - **Expected:** an answer citing both definition pages and the canonical owner.
8. **MCP tools:** in Rovo Studio, create a custom agent and add the **OneNumber Metrics** tools.

Rovo is required for steps 7–8 only. Everything else works on any Jira + Confluence site.
