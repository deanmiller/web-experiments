import { getGpuDevice } from "../../js/webgpu/device.js";
import glslangModule from "../../thirdparties/glslang.js";
import { getShaderSource } from "../../js/webgpu/shader_loader.js";

// https://github.com/gpuweb/gpuweb
// https://austineng.github.io/webgpu-samples/#helloTriangle
// https://github.com/redcamel/webgpu

const shaderConfig = {
    fragPath: './shader.frag',
    vertPath: './shader.vert',
    positionAttributeLocation: 0
};

const triangles = {
    triangleCount: 2,
    vertexCount: 6,
    vertexSize: 4 * 4, // 4 floats (each float is 4 bytes)
    positionOffset: 0,
    vertices: new Float32Array([
        -0.1, 0.5, 0.0, 1.0,
        -0.5, -0.5, 0.0, 1.0,
        -0.1, -0.5, 0.0, 1.0,

        0.1, 0.5, 0.0, 1.0,
        0.1, -0.5, 0.0, 1.0,
        0.5, -0.5, 0.0, 1.0
    ]),
    indices: new Int32Array([
        0, 1, 2,
        3, 4, 5,
        2, 3, 0,
        2, 4, 3
    ])
};

async function init() {

    const device = await getGpuDevice();

    //=> Init canvas
    const canvas = document.getElementById('targetCanvas');

    let canvasSize = canvas.getBoundingClientRect();
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // Obtain a drawing context.
    const context = canvas.getContext('gpupresent');

    const swapChain = context.configureSwapChain({
        device: device,
        format: "bgra8unorm"
    });

    //=> Compile shaders.
    const glslang = await glslangModule(); // Fetch the wasm glslang module.
    const fragSource = await getShaderSource(shaderConfig.fragPath);
    const vertSource = await getShaderSource(shaderConfig.vertPath);
    const frag = glslang.compileGLSL(fragSource, 'fragment');
    const vert = glslang.compileGLSL(vertSource, 'vertex');

    //=> Create a buffer for the triangles.
    const verticesBuffer = device.createBuffer({
        size: triangles.vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    verticesBuffer.setSubData(0, triangles.vertices);

    //=> Create a buffer for the indices.
    const indexBuffer = device.createBuffer({
        size: triangles.indices.byteLength,
        usage: GPUBufferUsage.INDEX  | GPUBufferUsage.COPY_DST
    });
    indexBuffer.setSubData(0, triangles.indices);
    indexBuffer.indexCount = triangles.indices.length;

    // Create a render pipeline.
    const renderPipeline = device.createRenderPipeline({
        vertexStage: {
            module: device.createShaderModule({
                code: vert,
                source: vertSource,
                transform: source => glslang.compileGLSL(source, 'vertex'),
            }),
            entryPoint: 'main'
        },
        fragmentStage: {
            module: device.createShaderModule({
                code: frag,
                source:fragSource,
                transform: source => glslang.compileGLSL(source, 'fragment'),
            }),
            entryPoint: 'main'
        },
        primitiveTopology: "triangle-list",
        vertexState: {
            vertexBuffers: [{
                arrayStride: triangles.vertexSize,
                attributes: [{
                    // position
                    shaderLocation: shaderConfig.positionAttributeLocation,
                    offset: triangles.positionOffset,
                    format: "float4"
                }]
            }]
        },
        rasterizationState: {
            cullMode: 'back',
        },
        colorStates: [{
            format: "bgra8unorm"
        }],
    });

    function frame() {
        const commandEncoder = device.createCommandEncoder();
        const textureView = swapChain.getCurrentTexture().createView();

        const renderPassDescriptor = {
            colorAttachments: [{
                attachment: textureView,
                loadValue: { r: 0.3, g: 0.2, b: 0.1, a: 1.0 },
            }],
        };

        // https://gpuweb.github.io/gpuweb/#dom-gpurenderencoderbase-drawindexed
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(renderPipeline);

        passEncoder.setVertexBuffer(0, verticesBuffer);
        passEncoder.setIndexBuffer(indexBuffer);
        passEncoder.drawIndexed(indexBuffer.indexCount, 1, 0, 0, 0);

        passEncoder.endPass();

        device.defaultQueue.submit([commandEncoder.finish()]);
    }

    function loop() {
        // Render the frame.
        frame();

        // Ask for another frame.
        requestAnimationFrame(loop);
    }

    // Start the continuous render.
    loop();
}

init();
