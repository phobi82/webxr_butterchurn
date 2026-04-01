// This module owns generic menu section/control state builders.
const getMenuModeLabelByKey = function(definitions, key, fallbackLabel) {
	const index = findModeIndexByKey(definitions || [], key);
	return index >= 0 && definitions[index] ? definitions[index].label : (fallbackLabel || "");
};

const formatMenuPercentText = function(value) {
	return Math.round(value * 100) + "%";
};

const createMenuSectionState = function(args) {
	args = args || {};
	return {
		key: args.key || "",
		title: args.title || "",
		badgeText: args.badgeText || "",
		statusText: args.statusText || "",
		statusTone: args.statusTone || "muted",
		controls: args.controls || []
	};
};

const createCyclerMenuControlState = function(args) {
	args = args || {};
	return {
		type: "cycler",
		key: args.key || "",
		label: args.label || "",
		valueText: args.valueText || "",
		metaText: args.metaText || "",
		hoveredAction: args.hoveredAction || ""
	};
};

const createChoiceRowMenuControlState = function(args) {
	args = args || {};
	return {
		type: "choiceRow",
		key: args.key || "",
		label: args.label || "",
		rowStyle: args.rowStyle || "choice",
		items: args.items || []
	};
};

const createCheckboxMenuControlState = function(args) {
	args = args || {};
	return {
		type: "checkbox",
		key: args.key || "",
		label: args.label || "",
		valueText: args.valueText || "",
		checkedBool: !!args.checkedBool,
		hoveredBool: !!args.hoveredBool
	};
};

const createSessionMenuSectionState = function(args) {
	args = args || {};
	if (!args.xrSessionActiveBool) {
		return null;
	}
	return createMenuSectionState({
		key: "session",
		title: "Session",
		statusText: "Leave the current immersive session.",
		controls: [
			createChoiceRowMenuControlState({
				key: "sessionAction",
				label: "",
				items: [
					{
						key: "exitVr",
						label: "Exit VR",
						metaText: "End session",
						selectedBool: true,
						hoveredBool: !!args.hoveredExitVrBool
					}
				]
			})
		]
	});
};

const createSliderMenuControlState = function(args) {
	args = args || {};
	return {
		type: "slider",
		key: args.key || "",
		label: args.label || "",
		valueText: args.valueText || "",
		sliderU: args.sliderU || 0,
		minLabel: args.minLabel || "",
		maxLabel: args.maxLabel || "",
		hoveredBool: !!args.hoveredBool,
		activeBool: !!args.activeBool
	};
};

const appendSliderMenuControls = function(targetControls, sliderControls) {
	sliderControls = sliderControls || [];
	for (let i = 0; i < sliderControls.length; i += 1) {
		const sliderControl = sliderControls[i];
		if (!sliderControl || !sliderControl.control) {
			continue;
		}
		targetControls.push(createSliderMenuControlState({
			key: sliderControl.control.key,
			label: sliderControl.control.label,
			valueText: sliderControl.control.valueText || formatMenuPercentText(sliderControl.control.value),
			sliderU: sliderControl.sliderU || 0,
			minLabel: sliderControl.control.minLabel,
			maxLabel: sliderControl.control.maxLabel,
			hoveredBool: !!sliderControl.hoveredBool,
			activeBool: !!sliderControl.activeBool
		}));
	}
};

const createJumpModeMenuSectionState = function(args) {
	args = args || {};
	return createMenuSectionState({
		key: "jumpMode",
		title: "Jump Mode",
		controls: [
			createChoiceRowMenuControlState({
				key: "jumpMode",
				label: "",
				items: [
					{
						key: "double",
						label: "Double",
						metaText: "2 jumps total",
						selectedBool: args.selectedJumpMode === "double",
						hoveredBool: args.hoveredJumpMode === "double"
					},
					{
						key: "multi",
						label: "Multi",
						metaText: "Unlimited jumps",
						selectedBool: args.selectedJumpMode === "multi",
						hoveredBool: args.hoveredJumpMode === "multi"
					}
				]
			})
		]
	});
};

const createWorldOpacityMenuSectionState = function(args) {
	args = args || {};
	return createMenuSectionState({
		key: "worldOpacity",
		title: "World Opacity",
		badgeText: formatMenuPercentText(args.value || 0),
		controls: [
			createSliderMenuControlState({
				key: "floorAlpha",
				label: "",
				valueText: "",
				sliderU: args.sliderU || 0,
				minLabel: "Invisible",
				maxLabel: "Solid",
				hoveredBool: !!args.hoveredBool,
				activeBool: !!args.activeBool
			})
		]
	});
};

const createEyeDistanceMenuSectionState = function(args) {
	args = args || {};
	return createMenuSectionState({
		key: "eyeDistance",
		title: "Eye Distance",
		badgeText: Math.round((args.value || 0) * 1000) + " mm",
		controls: [
			createSliderMenuControlState({
				key: "eyeDistance",
				label: "",
				valueText: "",
				sliderU: args.sliderU || 0,
				minLabel: Math.round((args.min || 0) * 1000) + " mm",
				maxLabel: Math.round((args.max || 0) * 1000) + " mm",
				hoveredBool: !!args.hoveredBool,
				activeBool: !!args.activeBool
			})
		]
	});
};

const createVisualizerModeMenuSectionState = function(args) {
	args = args || {};
	return createMenuSectionState({
		key: "visualizerMode",
		title: "Visualizer Mode",
		controls: [
			createCyclerMenuControlState({
				key: "visualizerMode",
				label: "",
				valueText: args.valueText || "",
				metaText: args.metaText || "",
				hoveredAction: args.hoveredAction || ""
			}),
			createCheckboxMenuControlState({
				key: "visualizerHorizontalMirror",
				label: "Horiz. Mirror (Kaleidoscope-Mode)",
				valueText: args.checkboxValueText || "",
				checkedBool: !!args.horizontalMirrorBool,
				hoveredBool: !!args.hoveredHorizontalMirrorBool
			})
		]
	});
};

const createButterchurnPresetMenuSectionState = function(args) {
	args = args || {};
	return createMenuSectionState({
		key: "butterchurnPreset",
		title: "Butterchurn Preset",
		controls: [
			createCyclerMenuControlState({
				key: "butterchurnPreset",
				label: "",
				valueText: args.valueText || "",
				metaText: args.metaText || "",
				hoveredAction: args.hoveredAction || ""
			})
		]
	});
};

const createBackgroundMenuSectionState = function(args) {
	args = args || {};
	const uiState = args.uiState || {};
	const controls = [];
	controls.push(createChoiceRowMenuControlState({
		key: "backgroundMixMode",
		label: "Mix Mode",
		items: (uiState.mixModes || []).map(function(item) {
			return {
				key: item.key,
				label: item.label,
				selectedBool: item.key === uiState.selectedMixModeKey,
				hoveredBool: item.key === args.hoveredMixModeKey
			};
		})
	}));
	appendSliderMenuControls(controls, args.sliderControls);
	return createMenuSectionState({
		key: "background",
		title: "Background",
		badgeText: formatMenuPercentText(uiState.visibleShare || 0),
		controls: controls
	});
};

const createPassthroughMenuSectionState = function(args) {
	args = args || {};
	const uiState = args.uiState || {};
	const controls = [];
	const passthroughSliderControls = args.sliderControls || [];
	const flashlightSliderControls = [];
	const depthSliderControls = [];
	const depthSliderControlByKey = {};
	const echoReactiveControlByKey = {};
	const appendDepthSliderControlByKey = function(controlKey) {
		const sliderControl = depthSliderControlByKey[controlKey];
		if (!sliderControl || !sliderControl.control) {
			return;
		}
		controls.push(createSliderMenuControlState({
			key: sliderControl.control.key,
			label: sliderControl.control.label,
			valueText: sliderControl.control.valueText || formatMenuPercentText(sliderControl.control.value),
			sliderU: sliderControl.sliderU || 0,
			minLabel: sliderControl.control.minLabel,
			maxLabel: sliderControl.control.maxLabel,
			hoveredBool: !!sliderControl.hoveredBool,
			activeBool: !!sliderControl.activeBool
		}));
	};
	for (let i = 0; i < passthroughSliderControls.length; i += 1) {
		const sliderControl = passthroughSliderControls[i];
		const controlKey = sliderControl && sliderControl.control ? sliderControl.control.key : "";
		if (controlKey.indexOf("depth") === 0) {
			depthSliderControls.push(sliderControl);
			depthSliderControlByKey[controlKey] = sliderControl;
			continue;
		}
		flashlightSliderControls.push(sliderControl);
	}
	for (let i = 0; i < (uiState.echoReactiveControls || []).length; i += 1) {
		echoReactiveControlByKey[uiState.echoReactiveControls[i].key] = uiState.echoReactiveControls[i];
	}
	controls.push(createCheckboxMenuControlState({
		key: "passthroughFlashlightToggle",
		label: "Flashlight",
		valueText: uiState.flashlightActiveBool ? "On" : "Off",
		checkedBool: !!uiState.flashlightActiveBool,
		hoveredBool: args.hoveredPassthroughToggle === "flashlight"
	}));
	appendSliderMenuControls(controls, flashlightSliderControls);
	if (uiState.usableDepthAvailableBool) {
		controls.push(createCheckboxMenuControlState({
			key: "passthroughDepthToggle",
			label: "Depth",
			valueText: uiState.depthActiveBool ? "On" : "Off",
			checkedBool: !!uiState.depthActiveBool,
			hoveredBool: args.hoveredPassthroughToggle === "depth"
		}));
	}
	if (uiState.usableDepthAvailableBool && uiState.depthActiveBool) {
		controls.push(createCheckboxMenuControlState({
			key: "passthroughDepthRadialToggle",
			label: "real Distance Metric",
			valueText: uiState.depthRadialBool ? "radial" : "planar",
			checkedBool: !!uiState.depthRadialBool,
			hoveredBool: args.hoveredPassthroughToggle === "depthRadial"
		}));
		controls.push(createCyclerMenuControlState({
			key: "passthroughDepthReconstruction",
			label: "Reconstruction",
			valueText: getMenuModeLabelByKey(uiState.depthReconstructionModes, uiState.selectedDepthReconstructionModeKey, "Heightmap"),
			hoveredAction: args.hoveredDepthReconstructionAction || ""
		}));
		controls.push(createCyclerMenuControlState({
			key: "passthroughDepthMode",
			label: "Depth Mode",
			valueText: getMenuModeLabelByKey(uiState.depthModes, uiState.selectedDepthModeKey, "Distance"),
			hoveredAction: args.hoveredDepthModeAction || ""
		}));
	}
	if (uiState.depthActiveBool && uiState.selectedDepthModeKey === "echo") {
		controls.push(createChoiceRowMenuControlState({
			key: "depthEchoReactiveRow",
			label: "Sound-reactive",
			rowStyle: "checkbox",
			items: (uiState.echoReactiveControls || []).map(function(item) {
				return {
					key: item.key,
					label: item.label,
					checkedBool: !!item.checkedBool,
					hoveredBool: args.hoveredEchoReactiveControlKey === item.key
				};
			})
		}));
		appendDepthSliderControlByKey("depthEchoPhase");
		appendDepthSliderControlByKey("depthEchoPhaseSpeed");
		appendDepthSliderControlByKey("depthEchoWavelength");
		appendDepthSliderControlByKey("depthEchoDutyCycle");
		appendDepthSliderControlByKey("depthEchoFade");
		appendDepthSliderControlByKey("depthMrRetain");
	} else {
		appendSliderMenuControls(controls, depthSliderControls);
	}
	return createMenuSectionState({
		key: "passthrough",
		title: "Passthrough",
		statusText: uiState.statusText || "",
		statusTone: uiState.availableBool ? "muted" : "warning",
		controls: controls
	});
};

const createSceneLightingMenuSectionState = function(args) {
	args = args || {};
	const controls = [
		createCyclerMenuControlState({
			key: "sceneLightingMode",
			label: "Lighting Mode",
			valueText: getMenuModeLabelByKey(args.lightingModes, args.selectedLightingModeKey, "Uniform"),
			hoveredAction: args.hoveredLightingModeAction || ""
		}),
		createCyclerMenuControlState({
			key: "sceneLightPreset",
			label: "Light Preset",
			valueText: args.currentLightPresetName || "Aurora Drift",
			metaText: args.currentLightPresetDescription || "",
			hoveredAction: args.hoveredLightPresetAction || ""
		})
	];
	appendSliderMenuControls(controls, args.sliderControls);
	return createMenuSectionState({
		key: "sceneLighting",
		title: "Scene Lighting",
		controls: controls
	});
};

const createLowerMenuSections = function(args) {
	args = args || {};
	// Lower interactive sections are composed here so xr-menu.js stays generic.
	return [
		createJumpModeMenuSectionState({
			selectedJumpMode: args.selectedJumpMode,
			hoveredJumpMode: args.hoveredJumpMode
		}),
		createEyeDistanceMenuSectionState({
			value: args.eyeDistanceMeters,
			min: args.eyeDistanceMin,
			max: args.eyeDistanceMax,
			sliderU: args.eyeDistanceSliderU,
			hoveredBool: args.eyeDistanceHoverBool,
			activeBool: args.eyeDistanceActiveBool
		}),
		createWorldOpacityMenuSectionState({
			value: args.floorAlpha,
			sliderU: args.floorAlphaSliderU,
			hoveredBool: args.floorAlphaHoverBool,
			activeBool: args.floorAlphaActiveBool
		}),
		createBackgroundMenuSectionState({
			uiState: args.passthroughUiState,
			hoveredMixModeKey: args.hoveredMixModeKey,
			sliderControls: args.backgroundControls
		}),
		createPassthroughMenuSectionState({
			uiState: args.passthroughUiState,
			hoveredPassthroughToggle: args.hoveredPassthroughToggle,
			hoveredDepthReconstructionAction: args.hoveredDepthReconstructionAction,
			hoveredDepthModeAction: args.hoveredDepthModeAction,
			sliderControls: args.passthroughControls
		}),
		createSceneLightingMenuSectionState({
			lightingModes: args.lightingModes,
			selectedLightingModeKey: args.selectedLightingModeKey,
			hoveredLightingModeAction: args.hoveredSceneLightingModeAction,
			currentLightPresetName: args.currentLightPresetName,
			currentLightPresetDescription: args.currentLightPresetDescription,
			hoveredLightPresetAction: args.hoveredLightPresetAction,
			sliderControls: args.sceneLightingControls
		}),
		createVisualizerModeMenuSectionState({
			valueText: args.currentShaderModeName,
			metaText: args.shaderModeMetaText,
			hoveredAction: args.hoveredShaderModeAction,
			horizontalMirrorBool: args.horizontalMirrorBool,
			checkboxValueText: args.horizontalMirrorBool ? "On" : "Off",
			hoveredHorizontalMirrorBool: args.hoveredHorizontalMirrorBool
		}),
		createButterchurnPresetMenuSectionState({
			valueText: args.currentPresetName,
			metaText: args.presetMetaText,
			hoveredAction: args.hoveredPresetAction
		}),
		createSessionMenuSectionState({
			xrSessionActiveBool: !!args.xrSessionActiveBool,
			hoveredExitVrBool: !!args.hoveredExitVrBool
		})
	].filter(Boolean);
};
