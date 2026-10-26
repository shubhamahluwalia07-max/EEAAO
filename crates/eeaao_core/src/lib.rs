use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApplicationModule {
    Account,
    Datum,
    Rados,
    Design,
    Fea,
    Slicer,
    PrintFactory,
    I50,
}

impl Default for ApplicationModule {
    fn default() -> Self {
        ApplicationModule::Rados
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppState {
    pub active_module: ApplicationModule,
    pub current_study_id: Option<String>,
    pub current_series_id: Option<String>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            active_module: ApplicationModule::Rados,
            current_study_id: None,
            current_series_id: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshBufferPayload {
    pub id: String,
    pub name: String,
    pub triangle_count: usize,
    pub vertex_count: usize,
    pub vertices: Vec<f32>,
    pub normals: Vec<f32>,
    pub indices: Vec<u32>,
    pub transform_matrix: [f32; 16],
}

#[derive(thiserror::Error, Debug, Serialize, Deserialize)]
pub enum CoreError {
    #[error("IO error: {0}")]
    Io(String),
    #[error("Invalid DICOM file: {0}")]
    InvalidDicom(String),
    #[error("Missing attribute: {0}")]
    MissingAttribute(String),
    #[error("Volume generation error: {0}")]
    VolumeError(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_core_app_state() {
        let state = AppState::default();
        assert_eq!(state.active_module, ApplicationModule::Rados);
    }
}

