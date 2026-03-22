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
		items: args.items || []
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
			valueText: formatMenuPercentText(sliderControl.control.value),
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

const createPassthroughMenuSectionState = function(args) {
	args = args || {};
	const uiState = args.uiState || {};
	const controls = [];
	controls.push(createCyclerMenuControlState({
		key: "passthroughBlendMode",
		label: "Blend Mode",
		valueText: getMenuModeLabelByKey(uiState.blendModes, uiState.selectedBlendModeKey, "Uniform"),
		hoveredAction: args.hoveredBlendModeAction || ""
	}));
	if (uiState.uniformBlendModeVisibleBool) {
		controls.push(createChoiceRowMenuControlState({
			key: "passthroughUniformBlendMode",
			label: "Uniform Blend",
			items: (uiState.uniformBlendModes || []).map(function(item) {
				return {
					key: item.key,
					label: item.label,
					selectedBool: item.key === uiState.selectedUniformBlendModeKey,
					hoveredBool: item.key === args.hoveredUniformBlendModeKey
				};
			})
		}));
	}
	appendSliderMenuControls(controls, args.sliderControls);
	return createMenuSectionState({
		key: "passthrough",
		title: "Passthrough",
		badgeText: formatMenuPercentText(uiState.visibleShare || 0),
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
		createWorldOpacityMenuSectionState({
			value: args.floorAlpha,
			sliderU: args.floorAlphaSliderU,
			hoveredBool: args.floorAlphaHoverBool,
			activeBool: args.floorAlphaActiveBool
		}),
		createPassthroughMenuSectionState({
			uiState: args.passthroughUiState,
			hoveredBlendModeAction: args.hoveredPassthroughBlendModeAction,
			hoveredUniformBlendModeKey: args.hoveredPassthroughUniformBlendModeKey,
			sliderControls: args.passthroughControls
		}),
		createEyeDistanceMenuSectionState({
			value: args.eyeDistanceMeters,
			min: args.eyeDistanceMin,
			max: args.eyeDistanceMax,
			sliderU: args.eyeDistanceSliderU,
			hoveredBool: args.eyeDistanceHoverBool,
			activeBool: args.eyeDistanceActiveBool
		}),
		createVisualizerModeMenuSectionState({
			valueText: args.currentShaderModeName,
			metaText: args.shaderModeMetaText,
			hoveredAction: args.hoveredShaderModeAction
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
