# Driver: g = {'BUILD': [...], 'EXPORT': bool}; exec(open(.../ws_go.py).read(), g)
import os
_SPW = r"."  # the folder holding these scripts
_g = globals()
for _m in ['ws_kit.py', 'sb_ball.py', 'ws_stadium.py', 'ws_stadium2.py', 'ws_plaza.py', 'ws_props.py', 'ws_far.py', 'ws_far2.py', 'ws_podium.py', 'ws_front.py', 'ws_people.py']:
    _p = os.path.join(_SPW, _m)
    if os.path.exists(_p): exec(compile(open(_p, encoding='utf-8').read(), _p, 'exec'), _g)
rep = {}
for _b in _g.get('BUILD', []):
    _g['build_' + _b]()
    rep[_b] = tri_count(bpy.data.collections['ws-' + _b])
if _g.get('EXPORT'):
    for _b in _g.get('BUILD', []): rep[_b + '_bytes'] = ws_export('ws-' + _b)
