use super::types::{
    ExportAsset, ExportClip, ExportProjectMeta, ExportShapeProps, ExportTimelinePayload,
    ExportTrack,
};
use super::*;

#[test]
fn build_concat_args_inserts_timeline_gaps_and_overlays() {
    let plan = ExportPlan {
        clips: vec![
            ClipExportInfo {
                asset_path: "C:/media/base-a.mp4".into(),
                trim_start: 0.0,
                trim_end: 1.0,
                fit_mode: None,
                crop_x: None,
                crop_y: None,
                crop_width: None,
                crop_height: None,
                canvas_width: Some(1280),
                canvas_height: Some(720),
                timeline_start: Some(0.0),
                timeline_duration: Some(1.0),
                fps: Some(30.0),
                has_audio: Some(false),
            },
            ClipExportInfo {
                asset_path: "C:/media/base-b.mp4".into(),
                trim_start: 0.0,
                trim_end: 1.0,
                fit_mode: None,
                crop_x: None,
                crop_y: None,
                crop_width: None,
                crop_height: None,
                canvas_width: Some(1280),
                canvas_height: Some(720),
                timeline_start: Some(2.0),
                timeline_duration: Some(1.0),
                fps: Some(30.0),
                has_audio: Some(false),
            },
        ],
        overlays: vec![OverlayExportInfo {
            asset_path: "C:/media/title.png".into(),
            asset_type: "image".into(),
            trim_start: 0.0,
            timeline_start: 0.5,
            timeline_duration: 1.25,
            x: 120.0,
            y: 80.0,
            width: 320.0,
            height: 180.0,
            opacity: 0.6,
            fit_mode: Some("fit".into()),
            crop_x: None,
            crop_y: None,
            crop_width: None,
            crop_height: None,
            z_index: 1,
        }],
        texts: Vec::new(),
        shapes: Vec::new(),
        audio_clips: Vec::new(),
    };

    let args = build_concat_args(&plan, "C:/exports/out.mp4");
    let filter_index = args
        .iter()
        .position(|arg| arg == "-filter_complex")
        .expect("filter_complex arg");
    let filter = &args[filter_index + 1];

    assert!(args.windows(2).any(|pair| pair == ["-loop", "1"]));
    assert!(filter.contains("color=c=black:s=1280x720:r=30.000:d=1.000"));
    assert!(filter.contains("concat=n=3:v=1:a=1[basev][basea]"));
    assert!(filter.contains("[2:v]scale=320:180"));
    assert!(filter.contains("colorchannelmixer=aa=0.600"));
    assert!(filter.contains("overlay=x=120:y=80:enable='between(t,0.500,1.750)'"));
    assert!(args.windows(2).any(|pair| pair == ["-map", "[v_visual0]"]));
}

#[test]
fn build_concat_args_burns_text_with_drawtext() {
    let plan = ExportPlan {
        clips: vec![ClipExportInfo {
            asset_path: "C:/media/base.mp4".into(),
            trim_start: 0.0,
            trim_end: 3.0,
            fit_mode: None,
            crop_x: None,
            crop_y: None,
            crop_width: None,
            crop_height: None,
            canvas_width: Some(1280),
            canvas_height: Some(720),
            timeline_start: Some(0.0),
            timeline_duration: Some(3.0),
            fps: Some(30.0),
            has_audio: Some(false),
        }],
        overlays: Vec::new(),
        texts: vec![TextExportInfo {
            text: "Hello: 'world', 100%".into(),
            font_family: "sans-serif".into(),
            font_size: 42.0,
            color: "#ffcc00".into(),
            align: "center".into(),
            timeline_start: 0.25,
            timeline_duration: 2.0,
            x: 100.0,
            y: 200.0,
            width: 500.0,
            height: 120.0,
            opacity: 0.75,
            shadow_color: Some("#000000".into()),
            shadow_x: Some(4.0),
            shadow_y: Some(6.0),
            outline_width: Some(2.0),
            outline_color: Some("#111111".into()),
            z_index: 2,
        }],
        shapes: Vec::new(),
        audio_clips: Vec::new(),
    };

    let args = build_concat_args(&plan, "C:/exports/out.mp4");
    let filter_index = args
        .iter()
        .position(|arg| arg == "-filter_complex")
        .expect("filter_complex arg");
    let filter = &args[filter_index + 1];

    assert!(filter.contains("drawtext=text='Hello\\: \\'world\\'\\, 100\\%'"));
    assert!(filter.contains("font='sans-serif'"));
    assert!(filter.contains("fontsize=42"));
    assert!(filter.contains("fontcolor=0xffcc00"));
    assert!(filter.contains("alpha=0.750"));
    assert!(filter.contains("x='100+(500-text_w)/2'"));
    assert!(filter.contains("y='200+(120-text_h)/2'"));
    assert!(filter.contains("enable='between(t,0.250,2.250)'"));
    assert!(filter.contains("borderw=2"));
    assert!(filter.contains("shadowx=4"));
    assert!(args.windows(2).any(|pair| pair == ["-map", "[v_visual0]"]));
}

#[test]
fn build_concat_args_draws_shape_layers() {
    let plan = ExportPlan {
        clips: vec![ClipExportInfo {
            asset_path: "C:/media/base.mp4".into(),
            trim_start: 0.0,
            trim_end: 4.0,
            fit_mode: None,
            crop_x: None,
            crop_y: None,
            crop_width: None,
            crop_height: None,
            canvas_width: Some(1280),
            canvas_height: Some(720),
            timeline_start: Some(0.0),
            timeline_duration: Some(4.0),
            fps: Some(30.0),
            has_audio: Some(false),
        }],
        overlays: Vec::new(),
        texts: Vec::new(),
        shapes: vec![
            ShapeExportInfo {
                shape_type: "rect".into(),
                fill: "#3a7bd5".into(),
                stroke: "#ffffff".into(),
                stroke_width: 4.0,
                corner_radius: Some(0.0),
                timeline_start: 0.5,
                timeline_duration: 2.0,
                x: 20.0,
                y: 40.0,
                width: 200.0,
                height: 120.0,
                opacity: 0.5,
                fps: 30.0,
                z_index: 1,
            },
            ShapeExportInfo {
                shape_type: "circle".into(),
                fill: "#ff0000".into(),
                stroke: "transparent".into(),
                stroke_width: 0.0,
                corner_radius: None,
                timeline_start: 1.0,
                timeline_duration: 1.5,
                x: 300.0,
                y: 80.0,
                width: 100.0,
                height: 100.0,
                opacity: 1.0,
                fps: 30.0,
                z_index: 2,
            },
        ],
        audio_clips: Vec::new(),
    };

    let args = build_concat_args(&plan, "C:/exports/out.mp4");
    let filter_index = args
        .iter()
        .position(|arg| arg == "-filter_complex")
        .expect("filter_complex arg");
    let filter = &args[filter_index + 1];

    assert!(filter.contains("drawbox=x=20:y=40:w=200:h=120:color=0x3a7bd5@0.500:t=fill"));
    assert!(filter.contains("drawbox=x=20:y=40:w=200:h=120:color=0xffffff@0.500:t=4"));
    assert!(filter.contains("color=c=black@0.0:s=100x100:r=30.000:d=1.500"));
    assert!(filter.contains(
        "geq=r='if(lte(pow((X-50.000)/50.000\\,2)+pow((Y-50.000)/50.000\\,2)\\,1)\\,255\\,0)'"
    ));
    assert!(filter.contains("overlay=x=300:y=80:enable='between(t,1.000,2.500)'"));
    assert!(args.windows(2).any(|pair| pair == ["-map", "[v_visual1]"]));
}

#[test]
fn build_concat_args_mixes_audio_tracks_with_silent_base_audio() {
    let plan = ExportPlan {
        clips: vec![ClipExportInfo {
            asset_path: "C:/media/base.mp4".into(),
            trim_start: 0.0,
            trim_end: 4.0,
            fit_mode: None,
            crop_x: None,
            crop_y: None,
            crop_width: None,
            crop_height: None,
            canvas_width: Some(1280),
            canvas_height: Some(720),
            timeline_start: Some(0.0),
            timeline_duration: Some(4.0),
            fps: Some(30.0),
            has_audio: Some(false),
        }],
        overlays: Vec::new(),
        texts: Vec::new(),
        shapes: Vec::new(),
        audio_clips: vec![
            AudioExportInfo {
                asset_path: "C:/media/music.wav".into(),
                trim_start: 1.0,
                timeline_start: 0.5,
                timeline_duration: 2.0,
                gain: 0.8,
            },
            AudioExportInfo {
                asset_path: "C:/media/voice.wav".into(),
                trim_start: 0.0,
                timeline_start: 1.25,
                timeline_duration: 1.5,
                gain: 1.0,
            },
        ],
    };

    let args = build_concat_args(&plan, "C:/exports/out.mp4");
    let filter_index = args
        .iter()
        .position(|arg| arg == "-filter_complex")
        .expect("filter_complex arg");
    let filter = &args[filter_index + 1];

    assert!(filter.contains("anullsrc=channel_layout=stereo:sample_rate=48000:d=4.000[a0]"));
    assert!(filter.contains("concat=n=1:v=1:a=1[basev][basea]"));
    assert!(filter.contains("[1:a]asetpts=PTS-STARTPTS,adelay=500:all=1,volume=0.800[aud0]"));
    assert!(filter.contains("[2:a]asetpts=PTS-STARTPTS,adelay=1250:all=1,volume=1.000[aud1]"));
    assert!(filter.contains("[basea][aud0][aud1]amix=inputs=3:duration=first:normalize=0[aout]"));
    assert!(args.windows(2).any(|pair| pair == ["-map", "[aout]"]));
}

#[test]
fn build_concat_args_uses_embedded_audio_when_present() {
    let plan = ExportPlan {
        clips: vec![ClipExportInfo {
            asset_path: "C:/media/base-with-audio.mp4".into(),
            trim_start: 0.0,
            trim_end: 2.0,
            fit_mode: None,
            crop_x: None,
            crop_y: None,
            crop_width: None,
            crop_height: None,
            canvas_width: Some(1280),
            canvas_height: Some(720),
            timeline_start: Some(0.0),
            timeline_duration: Some(2.0),
            fps: Some(30.0),
            has_audio: Some(true),
        }],
        overlays: Vec::new(),
        texts: Vec::new(),
        shapes: Vec::new(),
        audio_clips: Vec::new(),
    };

    let args = build_concat_args(&plan, "C:/exports/out.mp4");
    let filter_index = args
        .iter()
        .position(|arg| arg == "-filter_complex")
        .expect("filter_complex arg");
    let filter = &args[filter_index + 1];

    assert!(filter.contains("[0:a]asetpts=PTS-STARTPTS[a0]"));
    assert!(args.windows(2).any(|pair| pair == ["-map", "[basea]"]));
}

#[test]
fn build_plan_from_payload_excludes_hidden_tracks() {
    let payload = ExportTimelinePayload {
        project_meta: ExportProjectMeta {
            canvas_width: 1280,
            canvas_height: 720,
            fps: 30.0,
        },
        assets: vec![ExportAsset {
            id: "asset-1".into(),
            asset_type: "video".into(),
            path: "C:/media/hidden.mp4".into(),
        }],
        tracks: vec![
            ExportTrack {
                track_type: "video".into(),
                clips: vec![ExportClip {
                    asset_id: "asset-1".into(),
                    start: 0.0,
                    duration: 2.0,
                    trim_start: 0.0,
                    trim_end: 2.0,
                    playback_rate: Some(1.0),
                    x: Some(0.0),
                    y: Some(0.0),
                    width: Some(1280.0),
                    height: Some(720.0),
                    opacity: Some(1.0),
                    fit_mode: Some("fit".into()),
                    crop_rect: None,
                    text_props: None,
                    shape_props: None,
                }],
                visible: false,
                opacity: Some(1.0),
                z_index: Some(0),
            },
            ExportTrack {
                track_type: "shape".into(),
                clips: vec![ExportClip {
                    asset_id: String::new(),
                    start: 0.0,
                    duration: 2.0,
                    trim_start: 0.0,
                    trim_end: 2.0,
                    playback_rate: Some(1.0),
                    x: Some(10.0),
                    y: Some(10.0),
                    width: Some(100.0),
                    height: Some(100.0),
                    opacity: Some(1.0),
                    fit_mode: Some("fit".into()),
                    crop_rect: None,
                    text_props: None,
                    shape_props: Some(ExportShapeProps {
                        shape_type: "rect".into(),
                        fill: "#ffffff".into(),
                        stroke: "transparent".into(),
                        stroke_width: 0.0,
                        corner_radius: None,
                    }),
                }],
                visible: true,
                opacity: Some(1.0),
                z_index: Some(1),
            },
        ],
    };

    let plan = build_plan_from_payload(&payload).expect("export plan");

    assert!(plan.clips.is_empty());
    assert_eq!(plan.shapes.len(), 1);
    assert!(plan.audio_clips.is_empty());
}

#[test]
fn build_plan_from_payload_collects_audio_tracks() {
    let payload = ExportTimelinePayload {
        project_meta: ExportProjectMeta {
            canvas_width: 1280,
            canvas_height: 720,
            fps: 30.0,
        },
        assets: vec![
            ExportAsset {
                id: "video-1".into(),
                asset_type: "video".into(),
                path: "C:/media/base.mp4".into(),
            },
            ExportAsset {
                id: "audio-1".into(),
                asset_type: "audio".into(),
                path: "C:/media/music.wav".into(),
            },
        ],
        tracks: vec![
            ExportTrack {
                track_type: "video".into(),
                clips: vec![ExportClip {
                    asset_id: "video-1".into(),
                    start: 0.0,
                    duration: 4.0,
                    trim_start: 0.0,
                    trim_end: 4.0,
                    playback_rate: Some(1.0),
                    x: Some(0.0),
                    y: Some(0.0),
                    width: Some(1280.0),
                    height: Some(720.0),
                    opacity: Some(1.0),
                    fit_mode: Some("fit".into()),
                    crop_rect: None,
                    text_props: None,
                    shape_props: None,
                }],
                visible: true,
                opacity: Some(1.0),
                z_index: Some(0),
            },
            ExportTrack {
                track_type: "audio".into(),
                clips: vec![ExportClip {
                    asset_id: "audio-1".into(),
                    start: 1.5,
                    duration: 2.25,
                    trim_start: 0.5,
                    trim_end: 2.75,
                    playback_rate: Some(1.0),
                    x: Some(0.0),
                    y: Some(0.0),
                    width: Some(0.0),
                    height: Some(0.0),
                    opacity: Some(0.5),
                    fit_mode: Some("fit".into()),
                    crop_rect: None,
                    text_props: None,
                    shape_props: None,
                }],
                visible: true,
                opacity: Some(0.8),
                z_index: Some(-1),
            },
        ],
    };

    let plan = build_plan_from_payload(&payload).expect("export plan");

    assert_eq!(plan.clips.len(), 1);
    assert_eq!(plan.audio_clips.len(), 1);
    assert_eq!(plan.audio_clips[0].asset_path, "C:/media/music.wav");
    assert_eq!(plan.audio_clips[0].timeline_start, 1.5);
    assert_eq!(plan.audio_clips[0].timeline_duration, 2.25);
    assert_eq!(plan.audio_clips[0].gain, 0.4);
}
