use stage3_pacs::*;

fn main() {
    println!("Starting benchmark diagnostic test...");
    match run_benchmark_test_dataset() {
        Ok(report) => {
            println!("BENCHMARK TEST SUCCESS:");
            println!("  Total Series: {}", report.total_series);
            println!("  Primary Series: {}", report.primary_series_uid);
            println!("  Slice Count: {}", report.slice_count);
            println!("  Dimensions: {:?}", report.volume_dimensions);
            println!("  Spacing Verified: {}", report.spacing_verified);
        }
        Err(e) => {
            println!("BENCHMARK TEST FAILED: {}", e);
        }
    }
}
