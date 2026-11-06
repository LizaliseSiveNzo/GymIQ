import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({path:'/workout',saved:null}));
vi.mock('react-router-dom',()=>({useLocation:()=>({pathname:state.path}),Navigate:({to})=>`Redirect ${to}`}));
vi.mock('../../context/AuthContext.jsx',()=>({useAuth:()=>({loading:false,session:{user:{id:'one'}},profile:{id:'one',onboarded_at:'2026-10-01'}})}));
vi.mock('../membership.js',()=>({savedMembership:()=>state.saved,loadMembership:vi.fn()}));
import ProtectedRoute from '../../routes/ProtectedRoute.jsx';
const render=()=>renderToStaticMarkup(React.createElement(ProtectedRoute,null,React.createElement('span',null,'Screen available')));
beforeEach(()=>{state.path='/workout';state.saved={data:{kind:'trial',expires_at:'2000-01-01T00:00:00Z'}};vi.stubGlobal('navigator',{onLine:true});});
describe('membership route recovery',()=>{
 for(const path of ['/workout','/bank'])it(`rechecks an expired cached trial before redirecting ${path}`,()=>{state.path=path;const html=render();expect(html).toContain('Checking your GymIQ access');expect(html).not.toContain('Redirect');});
 it('keeps Account accessible so access can be refreshed',()=>{state.path='/more';expect(render()).toContain('Screen available');});
 it('does not delay a valid saved membership',()=>{state.saved.data.expires_at='2099-01-01T00:00:00Z';expect(render()).toContain('Screen available');});
 it('keeps saved training available offline',()=>{vi.stubGlobal('navigator',{onLine:false});expect(render()).toContain('Screen available');});
});
