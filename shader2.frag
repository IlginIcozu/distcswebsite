#ifdef GL_ES
precision mediump float;
#endif

#define PI 3.14159265359

varying vec2 vTexCoord;
uniform sampler2D uTexture0;
uniform sampler2D uTexture1;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_pixelDensity; // Pixel density uniform

// Function to generate random values
float random (vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

// Simplex-like noise
float noise (vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f*f*(3.0-2.0*f);

    return mix(a, b, u.x) + (c - a)*u.y*(1.0 - u.x) + (d - b)*u.x*u.y;
}

// Function for animated grain effect
float grain(vec2 st) {
    return random(st ); // Moving random noise for grain
}

void main() {
    // Adjust the resolution for pixel density
    vec2 adjustedResolution = (u_resolution / u_pixelDensity);

    // Normalize coordinates and correct for aspect ratio
    vec2 st = gl_FragCoord.xy / adjustedResolution;  // Adjust for pixel density

    // Apply aspect ratio correction: stretch X based on resolution to keep center true
    float aspectRatio = adjustedResolution.x / adjustedResolution.y;
    st = (st - 0.5) * vec2(aspectRatio, 1.0) + 0.5; // Centered and aspect-ratio corrected

    // Center the coordinates so (0,0) is the center of the screen
    vec2 centeredCoords = st * 2.0 - 1.0; // Now range is from -1.0 to 1.0

    // Use mouse position to create interactivity, normalizing it between 0 and 1
    vec2 mouseNorm = 1.0 - (u_mouse / adjustedResolution); // Adjust mouse position for pixel density
    mouseNorm.x *= aspectRatio; // Correct mouse position for aspect ratio

    // Modify noise scales with the mouse position for interactivity
    float n1 = noise(centeredCoords * (500.0 - mouseNorm.x * 10.0) + u_time * 0.5); // Dynamic noise scale with mouse X
    float n2 = noise(centeredCoords * (150.0 + mouseNorm.y * 50.0) + u_time * 0.2); // Dynamic noise scale with mouse Y
    float n3 = noise(centeredCoords * 1000.0); // Static high-frequency noise for texture
    
    // Combine the noise functions to create the appearance of a heightmap
    float height = n1 * 0.4 + n2 * 0.35 + n3 * 0.95;

    // Mapping u_mouse.x and u_mouse.y to the range [-20, 20]
    float mappedMouseX = mix(20.0, -20.0, u_mouse.x / adjustedResolution.x); // Map X from -20 to 20
    float mappedMouseY = mix(20.0, -20.0, u_mouse.y / adjustedResolution.y); // Map Y from -20 to 20

    // Use the mapped values for lightDir
    vec2 lightDir = normalize(vec2(mappedMouseX, mappedMouseY)); // Light direction based on mapped mouse

    // Calculate the distance of the mouse from the center (range between 0 and 1)
    float mouseDistToCenter = distance(u_mouse / adjustedResolution, vec2(0.5, 0.5));
    
    // Invert the distance to make the lightness stronger as the mouse gets closer to the center
    float lightnessFactor = 1.2 - mouseDistToCenter;

    // Apply the lightness factor to the light intensity
    float lightIntensity = dot(normalize(centeredCoords), lightDir) * 0.5 + 0.5;
    lightIntensity *= lightnessFactor; // Increase light intensity based on closeness to center

    // Apply lighting effect to the heightmap
    float shading = height * 0.5 + lightIntensity * 0.5;

    // Convert to high-contrast black and white
    float harshTexture = step(0.7, shading); // Step function for harsh threshold

    // Add animated grain to the texture
    float grainEffect = grain(centeredCoords) * 0.15; // Grain intensity adjustment
    
    // Output the harsh monochromatic texture with depth and grain
    vec3 color = vec3(harshTexture) - random(centeredCoords); 

    color -= vec3(harshTexture * n1 / n2) * random(centeredCoords); 
    color += vec3(harshTexture / n3) * random(centeredCoords); 
    color *= vec3(harshTexture * random(centeredCoords));

    // --- Begin Red Circle Addition ---

    // Calculate the distance from the current pixel to the center
    float distToCenter = distance(st, vec2(0.5));

    // Map the mouse distance to control the radius of the red circle
    float maxRadius = 0.06; // Maximum radius of the red circle
    float minRadius = 0.001; // Minimum radius of the red circle
    float radius = mix(maxRadius, minRadius, mouseDistToCenter / sqrt(0.01));

    // Create a smooth gradient for the red circle
    float redCircle = smoothstep(radius, radius * 0.1, distToCenter);

    // Adjust visibility based on mouse distance to center
    float visibility = 1.0 - (mouseDistToCenter / sqrt(0.05));
    visibility = clamp(visibility, 0.0, 1.0);

    // Multiply redCircle by visibility to control opacity
    redCircle *= visibility;

    // Blend the red circle with the existing color
    color = mix(color, vec3(0.6, 0.0, 0.0), redCircle);

    // --- End Red Circle Addition ---
    
    // Add grain effect to the final color
    color += vec3(grainEffect);

    // Blob effect (white blob follows mouse position)
    vec2 blobCenter = (u_mouse / adjustedResolution); // Adjust blob center based on aspect ratio
    float distToBlob = distance(st, blobCenter);
    float blob = smoothstep(0.15, 0.5, distToBlob); // Controls the size and softness of the blob

    // Add a shiny white blob to the final output
    color += vec3(1.0) * (blob); // Add bright white blob with soft edges

    // Set the final output color
    gl_FragColor = vec4(color, 1.0);
}
