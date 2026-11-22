# Workflow diagram

`workflow.mmd` defines the workflow nodes and edges. The main README embeds the same Mermaid source.
`workflow.source.html` lays out those nodes with the stack-diagram template, logos and Lucide pictograms.
`workflow.html` is the self-contained visual. Both PNG themes are screenshots of that HTML.

To update the diagram:

1. Edit the Mermaid source and its README copy.
2. Update the HTML layout to match the same nodes and edges.
3. Build the offline HTML with the stack-diagram skill.
4. Render both PNG themes and inspect their arrows, labels and groups.

With the stack-diagram skill installed, set `STACK_DIAGRAM_SKILL` to its directory. Then run these commands from the repository root:

```bash
python3 "$STACK_DIAGRAM_SKILL/scripts/build.py" \
  docs/diagrams/workflow.source.html docs/diagrams/icons \
  docs/diagrams/workflow.html --fonts "$STACK_DIAGRAM_SKILL/assets/fonts"
python3 "$STACK_DIAGRAM_SKILL/scripts/render_png.py" \
  docs/diagrams/workflow.html docs/diagrams/workflow.png --selector .canvas --scale 2
```

PNG generation needs Playwright and Chromium. No network access is needed to view the completed HTML.
Icon source URLs are recorded in `icons/manifest.json`. Brand logos remain the trademarks of their owners.
The template and fonts retain their accompanying MIT and SIL Open Font License notices.
Lucide pictograms use the ISC License; Devicon uses the MIT License. Their notices accompany the icons.

## Validation on 22 November 2026

Mermaid 11.12.0 parsed the source successfully. The README and Mermaid file match.
The stack-diagram view contains the same 12 nodes and 12 edges.
Chromium loaded every image, and all nodes and groups fit inside the canvas.
Both PNG themes were inspected. Each theme used a fresh page to avoid missing SVGs after a theme switch.
If a theme-switch render omits icons, render a temporary HTML copy with that theme set and use `--single`.

The documentation change used fast mode: 14 unit tests passed, with 100% line and branch coverage of `runner_setup.py`.
CLI integration tests did not run in fast mode. Product functional UI coverage remains N/A for this setup-helper repository.
