# MEDAM Studio Workspace Guardrails & Architecture Standards

## Strict Permanent Laws
- **Branding**: The platform is strictly named **MEDAM** (badge `MD`). Never use legacy project names in the UI.
- **Zero Placeholders**: Never render placeholder text, mock studies, dummy buttons, instructional sub-labels, or tech-stack badges anywhere in the UI. All controls must be connected to functional backend or client state.
- **Zero Proprietary Names**: Never write, mention, or reference any third-party proprietary software names (including competitor medical imaging or CAD packages) anywhere in UI labels, HTML titles, filenames, variable names, or comments. Maintain clean, original MEDAM terminology.
- **Local VENV Isolation**: All Python scientific dependencies must run and install strictly inside `D:\My codes\EEAAO\backend\.venv`—never globally.
- **Automated Benchmark Testing**: In automated tests, benchmarks, and diagnostic validation, always use the standard DICOM dataset located at `C:\Users\ShubhamAhluwalia\Downloads\Compressed\KAMLESH 202603583814.zip`.
- **UI Design System**: Origin UI with 50% Neumorphic rubber physics, soft dark slate typography (`#0F172A`) on matte alabaster surfaces (`#F8FAFC`) in Light Mode, obsidian (`#090D16`) in Dark Mode, and solid clinical blue (`#0284C7`) with pure white (`#FFFFFF`) icons and text for active selections.
- **Single Unified Top Bar**: Clean header with `MD` badge, `MEDAM` title, track switcher (`Medical`, `Industrial`, `Creative`), center Rotary Cylinder Flowbar, and right-aligned single utility buttons (Theme, Fullscreen, Collapse). No duplicated sub-bars or redundant toolbars.
- **Icon Toolbar Buttons**: All left rail tools must be crisp 36x36px icon buttons with no text labels inside or underneath, displaying a single floating tooltip card 12px to the right (`z-50`) on hover with the tool title and keyboard shortcut badge.
- **Diagnostic Accuracy**: 2D Multi-Planar Reconstruction (Coronal `#8B5CF6`, Axial `#06B6D4`, Sagittal `#F59E0B`) and Quadrant 4 3D Viewport must use exact physical millimeter spacing (`dx, dy, dz`) with an automatic zoom buffer (`0.78`) to prevent anatomical clipping or distortion.
