-- Brief 33 Part A (block 5 of 5, OPTIONAL): clear any captain set on the real 2027 teams during
-- Brief 32 testing. Real captains are entered in admin later. Run only if the captain check query
-- showed a captain on North Hedges or South Hedges. Never touches the QA season.

begin;

update teams
set captain_player_id = null
where season_id = (select id from seasons where not is_test order by year desc limit 1)
  and captain_player_id is not null;

select t.name, p.name as captain
from teams t left join players p on p.id = t.captain_player_id
join seasons s on s.id = t.season_id and not s.is_test
order by t.name;

commit;
