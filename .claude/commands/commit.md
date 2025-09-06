---
label: commit
---

Review ALL changes (not just those that you did) carefully with git diff, check the work thoroughly, and if everything looks good, create a git commit with a detailed summary of the changes.
DO NOT REMOVE OUR TEST SCRIPTS. if you feel any SHOULD be removed, prompt me.

Steps:
1. Run git diff to see all changes
2. Carefully review each change for:
   - Code quality and correctness
   - No debug code or console.logs left behind
   - Proper formatting (run pint if needed)
   - Tests passing if applicable
   - It's fine to include env files
3. If all looks good, create a commit with a detailed message that:
   - Summarizes what changed
   - Explains why the changes were made
   - Groups related changes logically
4. If issues are found, report them instead of committing