// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use stage3_pacs::models::{IngestionResult, SeriesVolumePayload};

#[tauri::command]
fn scan_dicom_directory(path: String) -> Result<IngestionResult, String> {
    stage3_pacs::scan_directory(&path)
}

#[tauri::command]
fn scan_dicom_zip(path: String) -> Result<IngestionResult, String> {
    stage3_pacs::scan_zip(&path)
}

#[tauri::command]
fn load_demo_study() -> Result<IngestionResult, String> {
    stage3_pacs::load_demo_study()
}

#[tauri::command]
fn get_series_volume(series_uid: String) -> Result<SeriesVolumePayload, String> {
    stage3_pacs::get_series_volume(&series_uid)
}

#[tauri::command]
fn run_benchmark_test_dataset() -> Result<stage3_pacs::BenchmarkDiagnosticReport, String> {
    stage3_pacs::run_benchmark_test_dataset()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_dicom_directory,
            scan_dicom_zip,
            load_demo_study,
            get_series_volume,
            run_benchmark_test_dataset
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
