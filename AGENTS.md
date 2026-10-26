# EEAAO Agent Instructions & Workspace Guardrails

## Strict Permanent Laws
- All toolbar buttons across the application must use crisp, relevant vector SVG icons (using lucide-react or clean 20x20 inline stroke SVGs) with no text labels inside the buttons, and display the tool name and keyboard shortcut inside a clean floating tooltip when hovered.
- Never add placeholder text, mock reference studies, dummy buttons, explanatory sub-labels, tech-stack badges, or emojis anywhere in the codebase. Maintain the strict ban on placeholder text, mock data, and third-party software names anywhere in the codebase.
- Typography: Use Plus Jakarta Sans and Inter across the application with medium weights (500 and 600) and natural sentence case / title case. No blocky uppercase shouting or monospace styling on UI elements.
- Design System: Origin UI with 50% Neumorphic rubber physics, soft dark slate typography (#0F172A) on matte alabaster surfaces (#F8FAFC), and solid clinical blue (#0284C7) with pure white icons/text (#FFFFFF) for active selections.
- Diagnostic Accuracy: Multi-Planar Reconstruction (Axial, Coronal, Sagittal) and 3D Volume View must use exact physical millimeter spacing ($dx$, $dy$, $dz$), bilinear/trilinear interpolation, and a mandatory 14% viewport buffer window to eliminate vertical clipping or horizontal distortion.
- NEVER include, mention, or reference any proprietary or third-party competitor software names anywhere in UI labels, HTML titles, component names, variable names, file names, or code comments. All features must use original EEAAO terminology.
- GLOBAL TESTING PROTOCOL: During all automated testing, verification, and diagnostic phases for Rados and downstream modules, always use the DICOM ZIP archive located at `C:\Users\ShubhamAhluwalia\Downloads\Compressed\KAMLESH 202603583814.zip` as the standard test dataset.
