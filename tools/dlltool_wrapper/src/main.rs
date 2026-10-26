use std::process::Command;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mut def_path = String::new();
    let mut out_path = String::new();
    let mut dll_name = String::new();

    let mut i = 1;
    while i < args.len() {
        if args[i] == "-d" && i + 1 < args.len() {
            def_path = args[i + 1].clone();
            i += 2;
        } else if args[i] == "-l" && i + 1 < args.len() {
            out_path = args[i + 1].clone();
            i += 2;
        } else if args[i] == "-D" && i + 1 < args.len() {
            dll_name = args[i + 1].clone();
            i += 2;
        } else {
            i += 1;
        }
    }

    if def_path.is_empty() || out_path.is_empty() {
        std::process::exit(0);
    }

    let actual_def_path = if !dll_name.is_empty() {
        if let Ok(content) = std::fs::read_to_string(&def_path) {
            let clean_dll = dll_name.trim_end_matches(".dll").to_string() + ".dll";
            let new_content = format!("LIBRARY \"{}\"\r\n{}", clean_dll, content);
            let temp_def = format!("{}.mod.def", def_path);
            let _ = std::fs::write(&temp_def, new_content);
            temp_def
        } else {
            def_path
        }
    } else {
        def_path
    };

    let lld_link = r"C:\Users\ShubhamAhluwalia\.rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin\gcc-ld\lld-link.exe";
    let status = Command::new(lld_link)
        .arg(format!("/def:{}", actual_def_path))
        .arg(format!("/out:{}", out_path))
        .arg("/machine:x64")
        .status();

    match status {
        Ok(s) => std::process::exit(s.code().unwrap_or(0)),
        Err(_) => std::process::exit(1),
    }
}
