"use client";
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DepthTexture, HalfFloatType, Matrix4, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, UnsignedIntType, Vector2, Vector4, WebGLRenderTarget } from 'three';
import { areaFocusBounds } from '@/domain/area-focus';
import type { MeetingArea } from '@/domain/meeting-areas';
export const AREA_FOCUS_FRAGMENT=`
   uniform sampler2D image; uniform sampler2D depth; uniform vec2 pixel; uniform mat4 inverseProjection; uniform mat4 world; uniform vec4 bounds; uniform float maskEnabled; varying vec2 uvPoint;
   void main(){vec4 source=texture2D(image,uvPoint);float d=texture2D(depth,uvPoint).x;vec4 view=inverseProjection*vec4(uvPoint*2.-1.,d*2.-1.,1.);vec3 p=(world*vec4(view.xyz/view.w,1.)).xyz;
    float inside=step(bounds.x,p.x)*step(p.x,bounds.y)*step(bounds.z,p.z)*step(p.z,bounds.w);float outside=maskEnabled*(1.-inside);
    vec3 blur=source.rgb*.2;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)blur+=texture2D(image,uvPoint+vec2(float(x),float(y))*pixel*3.).rgb*(.8/9.);
    vec3 dim=blur*.53+vec3(.035,.045,.06);gl_FragColor=vec4(mix(source.rgb,dim,outside),source.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`;
/** Physical render target pixels preserve native sharpness; blur offsets remain CSS-sized. */
export function applyAreaFocusResolution(target:WebGLRenderTarget,pixel:Vector2,logical:{width:number;height:number},drawingBuffer:Vector2){
 if(target.width!==drawingBuffer.x||target.height!==drawingBuffer.y){
  target.setSize(drawingBuffer.x,drawingBuffer.y);
  if(target.depthTexture){target.depthTexture.image.width=drawingBuffer.x;target.depthTexture.image.height=drawingBuffer.y;target.depthTexture.needsUpdate=true;}
 }
 pixel.set(1/Math.max(1,logical.width),1/Math.max(1,logical.height));
}
export function createAreaFocusEffect(){
  const target=new WebGLRenderTarget(1,1,{type:HalfFloatType});target.depthTexture=new DepthTexture(1,1,UnsignedIntType);
  const material=new ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{image:{value:target.texture},depth:{value:target.depthTexture},pixel:{value:new Vector2()},inverseProjection:{value:new Matrix4()},world:{value:new Matrix4()},bounds:{value:new Vector4()},maskEnabled:{value:1}},vertexShader:'varying vec2 uvPoint; void main(){uvPoint=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:AREA_FOCUS_FRAGMENT});
  const scene=new Scene(),quad=new Mesh(new PlaneGeometry(2,2),material);quad.frustumCulled=false;scene.add(quad);
  return {target,material,scene,camera:new OrthographicCamera(-1,1,1,-1,.1,2),geometry:quad.geometry,buffer:new Vector2()};

}
/** Depth-based world mask: only pixels outside the actual occupied area are softened. */
export function AreaFocus({area}:{area:MeetingArea|null}) {
 const {size}=useThree();
 const effect=useMemo(()=>createAreaFocusEffect(),[]);
 useEffect(()=>()=>{effect.target.dispose();effect.target.depthTexture?.dispose();effect.material.dispose();effect.geometry.dispose();},[effect]);
 useFrame(({gl,scene,camera})=>{
  const bounds=areaFocusBounds(area);if(!bounds){gl.render(scene,camera);return;}
  gl.getDrawingBufferSize(effect.buffer);applyAreaFocusResolution(effect.target,effect.material.uniforms.pixel.value,size,effect.buffer);
  const uniforms=effect.material.uniforms;uniforms.bounds.value.set(...bounds);uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);uniforms.world.value.copy(camera.matrixWorld);
  gl.setRenderTarget(effect.target);gl.clear();gl.render(scene,camera);gl.setRenderTarget(null);gl.render(effect.scene,effect.camera);
 },1);
 return null;
}
