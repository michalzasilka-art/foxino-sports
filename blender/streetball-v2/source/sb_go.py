# Driver: exec(open(SP + '/sb_go.py').read(), g) with g holding BUILD = ['court', ...], EXPORT = bool, SHOTS = [...]
import os
_SP = r"."  # the folder holding these scripts
_g = globals()
for _m in ['sb_kit.py', 'sb_court.py', 'sb_hoop.py', 'sb_fences.py', 'sb_wall.py', 'sb_city.py', 'sb_bleach.py', 'sb_props.py', 'sb_ball.py', 'sb_crowd.py', 'sb_extras.py']:
    _p = os.path.join(_SP, _m)
    if os.path.exists(_p): exec(compile(open(_p, encoding='utf-8').read(), _p, 'exec'), _g)
rep = {}
for _b in _g.get('BUILD', []):
    _g['build_' + _b]()
    rep[_b] = tri_count(bpy.data.collections['sb-' + _b])
if _g.get('EXPORT'):
    for _b in _g.get('BUILD', []):
        rep[_b + '_bytes'] = export('sb-' + _b)
for _s in _g.get('SHOTS', []):
    render(*_s)
rep['total'] = sum(tri_count(c) for c in bpy.data.collections if c.name.startswith('sb-'))
