import { Def } from "../../src/architecture-map/javascript/Def";
import { convertJsonToLatest } from "../../src/architecture-map/javascript/JsonConverter";

test("Context.convertJsonToLatest() To ver.3 <=", () => {
  let ver1Json = JSON.parse(`
    {
      "version": "1.0",
      "out_frame": {
        "x": 0,
        "y": 0,
        "width": 640,
        "height": 320
      },
      "architecture_map": [
        {
          "class": "ArchMod",
          "label": "Test Label",
          "dimens": {
            "x": 100,
            "y": 100,
            "width": 120,
            "height": 120,
            "pin_x": 160,
            "pin_y": 160,
            "label_rot_deg": 0,
            "label_align": "middle"
          },
          "clip_area": "left_top",
          "color_set": "orange"
        },
        {
          "class": "ArchMod",
          "label": "ArchMod",
          "dimens": {
            "x": 200,
            "y": 300,
            "width": 120,
            "height": 120,
            "pin_x": 260,
            "pin_y": 360,
            "label_rot_deg": 270,
            "label_align": "middle"
          },
          "clip_area": "none",
          "color_set": "gray"
        }
      ]
    }
  `);

  let latestJson = JSON.parse(`
    {
      "version": "${Def.VAL_VERSION}",
      "out_frame": {
        "class": "OutFrame",
        "dimens": {
          "height": 320,
          "width": 640,
          "x": 0,
          "y": 0,
          "z_order": 0
        },
        "uid": 0
      },
      "architecture_map": [
        {
          "uid": 1,
          "parent_uid": null,
          "hierarchy_depth": 1,
          "class": "ArchMod",
          "label": "Test Label",
          "dimens": {
            "x": 100,
            "y": 100,
            "width": 120,
            "height": 120,
            "pin_x": 160,
            "pin_y": 160,
            "label_rot_deg": 0,
            "label_horizontal_align": "center",
            "label_vertical_align": "middle",
            "z_order": 1
          },
          "clip_area": "left_top",
          "color_set": "orange",
          "edge_color_set": "orange"
        },
        {
          "uid": 2,
          "parent_uid": null,
          "hierarchy_depth": 1,
          "class": "ArchMod",
          "label": "ArchMod",
          "dimens": {
            "x": 200,
            "y": 300,
            "width": 120,
            "height": 120,
            "pin_x": 260,
            "pin_y": 360,
            "label_rot_deg": 270,
            "label_horizontal_align": "center",
            "label_vertical_align": "middle",
            "z_order": 2
          },
          "clip_area": "none",
          "color_set": "gray",
          "edge_color_set": "gray"
        }
      ]
    }
  `);

  var converted = convertJsonToLatest(ver1Json);

  expect(converted).toStrictEqual(latestJson);

} );

test("Context.convertJsonToLatest() To ver.5 <=", () => {
  let ver3Json = JSON.parse(`
      {
        "version": "3",
        "out_frame": {
          "x": 0,
          "y": 0,
          "width": 640,
          "height": 640
        },
        "architecture_map": [
          {
            "uid": 1,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "pin_x": 160,
              "pin_y": 160,
              "label_rot_deg": 0,
              "label_align": "middle"
            },
            "clip_area": "none",
            "color_set": "gray"
          },
          {
            "uid": 2,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 400,
              "y": 400,
              "width": 120,
              "height": 120,
              "pin_x": 460,
              "pin_y": 460,
              "label_rot_deg": 0,
              "label_align": "middle"
            },
            "clip_area": "left_top",
            "color_set": "gray"
          },
          {
            "uid": 3,
            "class": "Connector",
            "from_uid": 1,
            "to_uid": 2,
            "dimens": {
              "from_x": 160,
              "from_y": 200,
              "to_x": 460,
              "to_y": 400,
              "width": 4
            },
            "color_set": "blue"
          }
        ]
      }
    `);

  let latestJson = JSON.parse(`
      {
        "version": "${Def.VAL_VERSION}",
        "out_frame": {
          "class": "OutFrame",
          "dimens": {
            "height": 640,
            "width": 640,
            "x": 0,
            "y": 0,
            "z_order": 0
          },
          "uid": 0
        },
        "architecture_map": [
          {
            "uid": 1,
            "parent_uid": null,
            "hierarchy_depth": 1,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "pin_x": 160,
              "pin_y": 160,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "middle",
              "z_order": 1
            },
            "clip_area": "none",
            "color_set": "gray",
            "edge_color_set": "gray"
          },
          {
            "uid": 2,
            "parent_uid": null,
            "hierarchy_depth": 1,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 400,
              "y": 400,
              "width": 120,
              "height": 120,
              "pin_x": 460,
              "pin_y": 460,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "middle",
              "z_order": 2
            },
            "clip_area": "left_top",
            "color_set": "gray",
            "edge_color_set": "gray"
          },
          {
            "uid": 3,
            "class": "Connector",
            "from_uid": 1,
            "to_uid": 2,
            "dimens": {
              "from_x": 160,
              "from_y": 200,
              "to_x": 460,
              "to_y": 400,
              "width": 4,
              "z_order": 3
            },
            "from_marker_type": "none",
            "to_marker_type": "none",
            "color_set": "blue"
          }
        ]
      }
  `);

  var converted = convertJsonToLatest(ver3Json);

  expect(converted).toStrictEqual(latestJson);

} );

test("Context.convertJsonToLatest() To ver.6 <=", () => {
  let ver3Json = JSON.parse(`
      {
        "version": "5",
        "out_frame": {
          "x": 0,
          "y": 0,
          "width": 640,
          "height": 640
        },
        "architecture_map": [
          {
            "uid": 1,
            "class": "DividerLine",
            "dimens": {
              "from_x": 100,
              "from_y": 100,
              "to_x": 200,
              "to_y": 200,
              "width": 4
            },
            "color_set": "gray"
          }
        ]
      }
  `);

  let latestJson = JSON.parse(`
      {
        "version": "${Def.VAL_VERSION}",
        "out_frame": {
          "class": "OutFrame",
          "dimens": {
            "height": 640,
            "width": 640,
            "x": 0,
            "y": 0,
            "z_order": 0
          },
          "uid": 0
        },
        "architecture_map": [
          {
            "uid": 1,
            "class": "Line",
            "dimens": {
              "from_x": 100,
              "from_y": 100,
              "to_x": 200,
              "to_y": 200,
              "width": 4,
              "z_order": 1
            },
            "line_style": "normal",
            "from_marker_type": "none",
            "to_marker_type": "none",
            "color_set": "gray"
          }
        ]
      }
  `);

  var converted = convertJsonToLatest(ver3Json);

  expect(converted).toStrictEqual(latestJson);

} );

test("Context.convertJsonToLatest() To ver.7 <=", () => {
  let ver6Json = JSON.parse(`
      {
        "version": "6",
        "out_frame": {
          "x": 0,
          "y": 0,
          "width": 640,
          "height": 640
        },
        "architecture_map": [
          {
            "uid": 1,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "pin_x": 160,
              "pin_y": 160,
              "label_rot_deg": 0,
              "label_align": "middle"
            },
            "clip_area": "none",
            "color_set": "gray"
          },
          {
            "uid": 2,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 400,
              "y": 400,
              "width": 120,
              "height": 120,
              "pin_x": 460,
              "pin_y": 460,
              "label_rot_deg": 0,
              "label_align": "middle"
            },
            "clip_area": "left_top",
            "color_set": "gray"
          },
          {
            "uid": 3,
            "class": "Connector",
            "from_uid": 1,
            "to_uid": 2,
            "dimens": {
              "from_x": 160,
              "from_y": 200,
              "to_x": 460,
              "to_y": 400,
              "width": 4
            },
            "from_connector_end": "rect",
            "to_connector_end": "arrow",
            "color_set": "blue"
          },
          {
            "uid": 4,
            "class": "Line",
            "dimens": {
              "from_x": 100,
              "from_y": 100,
              "to_x": 200,
              "to_y": 200,
              "width": 4
            },
            "color_set": "gray"
          }
        ]
      }
  `);

  let latestJson = JSON.parse(`
      {
        "version": "${Def.VAL_VERSION}",
        "out_frame": {
          "class": "OutFrame",
          "dimens": {
            "height": 640,
            "width": 640,
            "x": 0,
            "y": 0,
            "z_order": 0
          },
          "uid": 0
        },
        "architecture_map": [
          {
            "uid": 1,
            "parent_uid": null,
            "hierarchy_depth": 1,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "pin_x": 160,
              "pin_y": 160,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "middle",
              "z_order": 1
            },
            "clip_area": "none",
            "color_set": "gray",
            "edge_color_set": "gray"
          },
          {
            "uid": 2,
            "parent_uid": null,
            "hierarchy_depth": 1,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 400,
              "y": 400,
              "width": 120,
              "height": 120,
              "pin_x": 460,
              "pin_y": 460,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "middle",
              "z_order": 2
            },
            "clip_area": "left_top",
            "color_set": "gray",
            "edge_color_set": "gray"
          },
          {
            "uid": 3,
            "class": "Connector",
            "from_uid": 1,
            "to_uid": 2,
            "dimens": {
              "from_x": 160,
              "from_y": 200,
              "to_x": 460,
              "to_y": 400,
              "width": 4,
              "z_order": 3
            },
            "from_marker_type": "rect",
            "to_marker_type": "arrow",
            "color_set": "blue"
          },
          {
            "uid": 4,
            "class": "Line",
            "dimens": {
              "from_x": 100,
              "from_y": 100,
              "to_x": 200,
              "to_y": 200,
              "width": 4,
              "z_order": 4
            },
            "line_style": "normal",
            "from_marker_type": "none",
            "to_marker_type": "none",
            "color_set": "gray"
          }
        ]
      }
  `);

  var converted = convertJsonToLatest(ver6Json);

  expect(converted).toStrictEqual(latestJson);

} );

// Add line_style setting to Line.
test("Context.convertJsonToLatest() To ver.8 <=", () => {
  let ver7Json = JSON.parse(`
      {
        "version": "7",
        "out_frame": {
          "x": 0,
          "y": 0,
          "width": 640,
          "height": 640
        },
        "architecture_map": [
          {
            "uid": 1,
            "class": "Line",
            "dimens": {
              "from_x": 100,
              "from_y": 100,
              "to_x": 200,
              "to_y": 200,
              "width": 4
            },
            "from_marker_type": "none",
            "to_marker_type": "none",
            "color_set": "gray"
          }
        ]
      }
  `);

  let latestJson = JSON.parse(`
      {
        "version": "${Def.VAL_VERSION}",
        "out_frame": {
          "class": "OutFrame",
          "dimens": {
            "height": 640,
            "width": 640,
            "x": 0,
            "y": 0,
            "z_order": 0
          },
          "uid": 0
        },
        "architecture_map": [
          {
            "uid": 1,
            "class": "Line",
            "dimens": {
              "from_x": 100,
              "from_y": 100,
              "to_x": 200,
              "to_y": 200,
              "width": 4,
              "z_order": 1
            },
            "line_style": "normal",
            "from_marker_type": "none",
            "to_marker_type": "none",
            "color_set": "gray"
          }
        ]
      }
  `);

  var converted = convertJsonToLatest(ver7Json);

  expect(converted).toStrictEqual(latestJson);

} );

// Add line_style setting to Line.
test("Context.convertJsonToLatest() To ver.10 <=", () => {
  let ver8Json = JSON.parse(`
      {
        "version": "8",
        "out_frame": {
          "x": 0,
          "y": 0,
          "width": 640,
          "height": 640
        },
        "architecture_map": [
          {
            "uid": 1,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "pin_x": 160,
              "pin_y": 160,
              "label_rot_deg": 0,
              "label_align": "middle"
            },
            "clip_area": "none",
            "color_set": "gray"
          }
        ]
      }
  `);

  let latestJson = JSON.parse(`
      {
        "version": "${Def.VAL_VERSION}",
        "out_frame": {
          "class": "OutFrame",
          "dimens": {
            "height": 640,
            "width": 640,
            "x": 0,
            "y": 0,
            "z_order": 0
          },
          "uid": 0
        },
        "architecture_map": [
          {
            "uid": 1,
            "parent_uid": null,
            "hierarchy_depth": 1,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "pin_x": 160,
              "pin_y": 160,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "middle",
              "z_order": 1
            },
            "clip_area": "none",
            "color_set": "gray",
            "edge_color_set": "gray"
          }
        ]
      }
  `);

  var converted = convertJsonToLatest(ver8Json);

  expect(converted).toStrictEqual(latestJson);

} );

// Add edge_color_set setting to ArchMod.
test("Context.convertJsonToLatest() To ver.11 <=", () => {
  let ver10Json = JSON.parse(`
      {
        "version": "10",
        "out_frame": {
          "x": 0,
          "y": 0,
          "width": 640,
          "height": 640
        },
        "architecture_map": [
          {
            "uid": 1,
            "parent_uid": null,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "pin_x": 160,
              "pin_y": 160,
              "label_rot_deg": 0,
              "label_align": "middle"
            },
            "clip_area": "none",
            "color_set": "red"
          }
        ]
      }
  `);

  let latestJson = JSON.parse(`
      {
        "version": "${Def.VAL_VERSION}",
        "out_frame": {
          "class": "OutFrame",
          "dimens": {
            "height": 640,
            "width": 640,
            "x": 0,
            "y": 0,
            "z_order": 0
          },
          "uid": 0
        },
        "architecture_map": [
          {
            "uid": 1,
            "parent_uid": null,
            "hierarchy_depth": 1,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "pin_x": 160,
              "pin_y": 160,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "middle",
              "z_order": 1
            },
            "clip_area": "none",
            "color_set": "red",
            "edge_color_set": "red"
          }
        ]
      }
  `);

  var converted = convertJsonToLatest(ver10Json);

  expect(converted).toStrictEqual(latestJson);

} );

// Convert label_align to label_horizontal_align/label_vertical_align in ArchMOd and TextLabel.
test("Context.convertJsonToLatest() To ver.12 <=", () => {
  let ver11Json = JSON.parse(`
      {
        "version": "11",
        "out_frame": {
          "x": 0,
          "y": 0,
          "width": 640,
          "height": 640
        },
        "architecture_map": [
          {
            "uid": 1,
            "parent_uid": null,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "pin_x": 160,
              "pin_y": 160,
              "label_rot_deg": 0,
              "label_align": "middle"
            },
            "clip_area": "none",
            "color_set": "gray",
            "edge_color_set": "gray"
          },
          {
            "uid": 2,
            "class": "TextLabel",
            "label": "TextLabel",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "label_rot_deg": 0,
              "label_align": "middle"
            },
            "color_set": "white"
          }
        ]
      }
  `);

  let latestJson = JSON.parse(`
      {
        "version": "${Def.VAL_VERSION}",
        "out_frame": {
          "class": "OutFrame",
          "dimens": {
            "height": 640,
            "width": 640,
            "x": 0,
            "y": 0,
            "z_order": 0
          },
          "uid": 0
        },
        "architecture_map": [
          {
            "uid": 1,
            "parent_uid": null,
            "hierarchy_depth": 1,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "pin_x": 160,
              "pin_y": 160,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "middle",
              "z_order": 1
            },
            "clip_area": "none",
            "color_set": "gray",
            "edge_color_set": "gray"
          },
          {
            "uid": 2,
            "class": "TextLabel",
            "label": "TextLabel",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "middle",
              "z_order": 2
            },
            "color_set": "white"
          }
        ]
      }
  `);

  var converted = convertJsonToLatest(ver11Json);

  expect(converted).toStrictEqual(latestJson);

} );

// Add z_order of ArchMod/Connector/Line/TextLabel and update OutFrame.
test("Context.convertJsonToLatest() To ver.13 <=", () => {
  let ver12Json = JSON.parse(`
      {
        "version": "12",
        "out_frame": {
          "x": 0,
          "y": 0,
          "width": 640,
          "height": 640
        },
        "architecture_map": [
          {
            "uid": 1,
            "parent_uid": null,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "pin_x": 160,
              "pin_y": 160,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "middle"
            },
            "clip_area": "none",
            "color_set": "gray",
            "edge_color_set": "gray"
          },
          {
            "uid": 2,
            "class": "TextLabel",
            "label": "TextLabel",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "middle"
            },
            "color_set": "white"
          }
        ]
      }
  `);

  let latestJson = JSON.parse(`
      {
        "version": "${Def.VAL_VERSION}",
        "out_frame": {
          "class": "OutFrame",
          "dimens": {
            "height": 640,
            "width": 640,
            "x": 0,
            "y": 0,
            "z_order": 0
          },
          "uid": 0
        },
        "architecture_map": [
          {
            "uid": 1,
            "parent_uid": null,
            "hierarchy_depth": 1,
            "class": "ArchMod",
            "label": "ArchMod",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "pin_x": 160,
              "pin_y": 160,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "middle",
              "z_order": 1
            },
            "clip_area": "none",
            "color_set": "gray",
            "edge_color_set": "gray"
          },
          {
            "uid": 2,
            "class": "TextLabel",
            "label": "TextLabel",
            "dimens": {
              "x": 100,
              "y": 100,
              "width": 120,
              "height": 120,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "middle",
              "z_order": 2
            },
            "color_set": "white"
          }
        ]
      }
  `);

  var converted = convertJsonToLatest(ver12Json);

  expect(converted).toStrictEqual(latestJson);

} );

// Add hierarchy_depth to ArchMod.
test("Context.convertJsonToLatest() To ver.14 <=", () => {
  let ver13Json = JSON.parse(`
      {
        "version": 13,
        "out_frame": {
          "class": "OutFrame",
          "dimens": {
            "height": 640,
            "width": 640,
            "x": 0,
            "y": 0,
            "z_order": 0
          },
          "uid": 0
        },
        "architecture_map": [
          {
            "uid": 1,
            "parent_uid": null,
            "class": "ArchMod",
            "label": "LAYER 1",
            "dimens": {
              "x": 54,
              "y": 54,
              "width": 236,
              "height": 232,
              "pin_x": 114,
              "pin_y": 114,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "top",
              "z_order": 1
            },
            "clip_area": "none",
            "color_set": "gray",
            "edge_color_set": "gray"
          },
          {
            "uid": 2,
            "parent_uid": 1,
            "class": "ArchMod",
            "label": "LAYER 2",
            "dimens": {
              "x": 81,
              "y": 84,
              "width": 180,
              "height": 176,
              "pin_x": 141,
              "pin_y": 144,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "top",
              "z_order": 2
            },
            "clip_area": "none",
            "color_set": "gray",
            "edge_color_set": "gray"
          },
          {
            "uid": 3,
            "parent_uid": 2,
            "class": "ArchMod",
            "label": "LAYER 3",
            "dimens": {
              "x": 110,
              "y": 114,
              "width": 120,
              "height": 120,
              "pin_x": 170,
              "pin_y": 174,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "top",
              "z_order": 3
            },
            "clip_area": "none",
            "color_set": "gray",
            "edge_color_set": "gray"
          }
        ]
      }
  `);

  let latestJson = JSON.parse(`
      {
        "version": "${Def.VAL_VERSION}",
        "out_frame": {
          "class": "OutFrame",
          "dimens": {
            "height": 640,
            "width": 640,
            "x": 0,
            "y": 0,
            "z_order": 0
          },
          "uid": 0
        },
        "architecture_map": [
          {
            "uid": 1,
            "parent_uid": null,
            "hierarchy_depth": 1,
            "class": "ArchMod",
            "label": "LAYER 1",
            "dimens": {
              "x": 54,
              "y": 54,
              "width": 236,
              "height": 232,
              "pin_x": 114,
              "pin_y": 114,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "top",
              "z_order": 1
            },
            "clip_area": "none",
            "color_set": "gray",
            "edge_color_set": "gray"
          },
          {
            "uid": 2,
            "parent_uid": 1,
            "hierarchy_depth": 2,
            "class": "ArchMod",
            "label": "LAYER 2",
            "dimens": {
              "x": 81,
              "y": 84,
              "width": 180,
              "height": 176,
              "pin_x": 141,
              "pin_y": 144,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "top",
              "z_order": 2
            },
            "clip_area": "none",
            "color_set": "gray",
            "edge_color_set": "gray"
          },
          {
            "uid": 3,
            "parent_uid": 2,
            "hierarchy_depth": 3,
            "class": "ArchMod",
            "label": "LAYER 3",
            "dimens": {
              "x": 110,
              "y": 114,
              "width": 120,
              "height": 120,
              "pin_x": 170,
              "pin_y": 174,
              "label_rot_deg": 0,
              "label_horizontal_align": "center",
              "label_vertical_align": "top",
              "z_order": 3
            },
            "clip_area": "none",
            "color_set": "gray",
            "edge_color_set": "gray"
          }
        ]
      }
  `);

  var converted = convertJsonToLatest(ver13Json);

  expect(converted).toStrictEqual(latestJson);

} );

