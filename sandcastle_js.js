const api_key = "YOUR_GOGGLE_MAP_API_KEY";
loadScript(
  "https://maps.googleapis.com/maps/api/js?key=" +
    api_key +
    "&libraries=places&callback=initAutocomplete",
  function () {
    console.log("Script loaded!");
    initAutocomplete();
  }
);

const viewer = new Cesium.Viewer("cesiumContainer", {
  shadows: true,
});
viewer.extend(Cesium.viewerCesium3DTilesInspectorMixin);
const inspectorViewModel = viewer.cesium3DTilesInspector.viewModel;
const messageInfo = document.getElementById("info");

const scene = viewer.scene;
let tileset;

const viewModel = {
  tilesets: [
    {
      name: "Google Map 3DTiles",
      resource:
        "https://tile.googleapis.com/v1/3dtiles/root.json?key=" + api_key,
    },
    {
      name: "Tileset",
      resource: "../SampleData/Cesium3DTiles/Tilesets/Tileset/tileset.json",
    },
    {
      name: "Translucent",
      resource:
        "../SampleData/Cesium3DTiles/Batched/BatchedTranslucent/tileset.json",
    },
    {
      name: "Translucent/Opaque",
      resource:
        "../SampleData/Cesium3DTiles/Batched/BatchedTranslucentOpaqueMix/tileset.json",
    },
    {
      name: "Multi-color",
      resource:
        "../SampleData/Cesium3DTiles/Batched/BatchedColors/tileset.json",
    },
    {
      name: "Request Volume",
      resource:
        "../SampleData/Cesium3DTiles/Tilesets/TilesetWithViewerRequestVolume/tileset.json",
    },
    {
      name: "Batched",
      resource:
        "../SampleData/Cesium3DTiles/Batched/BatchedWithBatchTable/tileset.json",
    },
    {
      name: "Instanced",
      resource:
        "../SampleData/Cesium3DTiles/Instanced/InstancedWithBatchTable/tileset.json",
    },
    {
      name: "Instanced/Orientation",
      resource:
        "../SampleData/Cesium3DTiles/Instanced/InstancedOrientation/tileset.json",
    },
    {
      name: "Composite",
      resource: "../SampleData/Cesium3DTiles/Composite/Composite/tileset.json",
    },
    {
      name: "PointCloud",
      resource:
        "../SampleData/Cesium3DTiles/PointCloud/PointCloudRGB/tileset.json",
    },
    {
      name: "PointCloudConstantColor",
      resource:
        "../SampleData/Cesium3DTiles/PointCloud/PointCloudConstantColor/tileset.json",
    },
    {
      name: "PointCloudNormals",
      resource:
        "../SampleData/Cesium3DTiles/PointCloud/PointCloudNormals/tileset.json",
    },
    {
      name: "PointCloudBatched",
      resource:
        "../SampleData/Cesium3DTiles/PointCloud/PointCloudBatched/tileset.json",
    },
    {
      name: "PointCloudDraco",
      resource:
        "../SampleData/Cesium3DTiles/PointCloud/PointCloudDraco/tileset.json",
    },
  ],
  selectedTileset: undefined,
  shadows: true,
  elevation: true,
};

Cesium.knockout.track(viewModel);

const toolbar = document.getElementById("toolbar");
Cesium.knockout.applyBindings(viewModel, toolbar);

Cesium.knockout
  .getObservable(viewModel, "shadows")
  .subscribe(function (enabled) {
    viewer.shadows = enabled;
  });

Cesium.knockout
  .getObservable(viewModel, "elevation")
  .subscribe(function (enabled) {
    viewModel.elevation = enabled;
    if (!enabled) messageInfo.innerHTML = "";
  });

let resourceToLoad;
Cesium.knockout
  .getObservable(viewModel, "selectedTileset")
  .subscribe(async function (options) {
    if (Cesium.defined(tileset)) {
      scene.primitives.remove(tileset);
    }
    if (!Cesium.defined(options)) {
      inspectorViewModel.tileset = undefined;
      resourceToLoad = undefined;
      return;
    }

    resourceToLoad = options.resource;
    try {
      tileset = await Cesium.Cesium3DTileset.fromUrl(resourceToLoad, {
        enableDebugWireframe: true,
      });

      if (options.resource !== resourceToLoad) {
        // Another tileset was loaded. Discard the result.
        return;
      }
      viewer.scene.primitives.add(tileset);

      inspectorViewModel.tileset = tileset;
      viewer.zoomTo(
        tileset,
        new Cesium.HeadingPitchRange(
          0,
          -2.0,
          Math.max(100.0 - tileset.boundingSphere.radius, 0.0)
        )
      );

      const properties = tileset.properties;
      if (Cesium.defined(properties) && Cesium.defined(properties.Height)) {
        tileset.style = new Cesium.Cesium3DTileStyle({
          color: {
            conditions: [
              ["${Height} >= 83", "color('purple', 0.5)"],
              ["${Height} >= 80", "color('red')"],
              ["${Height} >= 70", "color('orange')"],
              ["${Height} >= 12", "color('yellow')"],
              ["${Height} >= 7", "color('lime')"],
              ["${Height} >= 1", "color('cyan')"],
              ["true", "color('blue')"],
            ],
          },
        });
      }
    } catch (error) {
      console.log(`Error loading tileset: ${error}`);
    }
  });

viewModel.selectedTileset = viewModel.tilesets[0];

const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
/*
handler.setInputAction(function (movement) {
  const feature = inspectorViewModel.feature;
  console.log("feature", feature)

  if (Cesium.defined(feature)) {
    const propertyIds = feature.getPropertyIds();
    const length = propertyIds.length;
    for (let i = 0; i < length; ++i) {
      const propertyId = propertyIds[i];
      console.log(`${propertyId}: ${feature.getProperty(propertyId)}`);
    }
  }

}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
*/

// Draws a circle at the position, and a line from the previous position.
const drawPointAndLine = (position, prevPosition) => {
  viewer.entities.removeAll();
  if (prevPosition) {
    viewer.entities.add({
      polyline: {
        positions: [prevPosition, position],
        width: 3,
        material: Cesium.Color.WHITE,
        clampToGround: true,
        classificationType: Cesium.ClassificationType.CESIUM_3D_TILE,
      },
    });
  }
  viewer.entities.add({
    position: position,
    ellipsoid: {
      radii: new Cesium.Cartesian3(1, 1, 1),
      material: Cesium.Color.RED,
    },
  });
};

// Compute, draw, and display the position's height relative to the previous position.
var prevPosition;
const processHeights = (newPosition) => {
  if (newPosition) {
    drawPointAndLine(newPosition, prevPosition);

    const newHeight = Cesium.Cartographic.fromCartesian(newPosition).height;
    let labelText = "Current altitude (meters above sea level): " + newHeight;
    if (prevPosition) {
      const prevHeight = Cesium.Cartographic.fromCartesian(prevPosition).height;
      labelText +=
        "<br><br>Height from previous point (meters):" +
        Math.abs(newHeight - prevHeight);
    }

    messageInfo.innerHTML = labelText;

    prevPosition = newPosition;
  } else {
    messageInfo.innerHTML = "";
  }
};

handler.setInputAction(function (event) {
  if (viewModel.elevation) {
    const earthPosition = viewer.scene.pickPosition(event.position);
    if (Cesium.defined(earthPosition)) {
      processHeights(earthPosition);
    }
  }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

handler.setInputAction(function (movement) {
  const feature = inspectorViewModel.feature;
  if (Cesium.defined(feature)) {
    feature.show = false;
  }
}, Cesium.ScreenSpaceEventType.MIDDLE_CLICK);

const zoomToViewport = (viewport) => {
  viewer.entities.add({
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArray([
        viewport.getNorthEast().lng(),
        viewport.getNorthEast().lat(),
        viewport.getSouthWest().lng(),
        viewport.getNorthEast().lat(),
        viewport.getSouthWest().lng(),
        viewport.getSouthWest().lat(),
        viewport.getNorthEast().lng(),
        viewport.getSouthWest().lat(),
        viewport.getNorthEast().lng(),
        viewport.getNorthEast().lat(),
      ]),
      width: 10,
      clampToGround: true,
      material: Cesium.Color.RED,
    },
  });
  viewer.flyTo(viewer.entities);
};

function initAutocomplete() {
  const autocomplete = new google.maps.places.Autocomplete(
    document.getElementById("pacViewPlace"),
    {
      fields: ["geometry", "name"],
    }
  );
  autocomplete.addListener("place_changed", () => {
    viewer.entities.removeAll();
    const place = autocomplete.getPlace();
    if (!place.geometry || !place.geometry.viewport) {
      window.alert("No viewport for input: " + place.name);
      return;
    }
    zoomToViewport(place.geometry.viewport);
  });
}

function loadScript(url, callback) {
  let script = document.createElement("script");
  script.type = "text/javascript";
  script.src = url;
  script.async = true;
  script.defer = true;
  script.onload = callback;
  document.body.appendChild(script);
}
