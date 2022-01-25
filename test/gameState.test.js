import {GameState, states, TDDPhase} from "../src/gameState"

test('initialisation', () => {
  let g = new GameState();
  expect(g.players[0]).toBe("John");
  expect(g.driver).toBe(0);
  expect(g.navigator).toBe(1);
  expect(g.state).toBe(states[0]);
  expect(g.stepCount).toBe(0);
  expect(g.iteration).toBe(0);
  expect(g.started).toBe(false);
});

test('start', () => {
    let g = new GameState();
    g.start();
    expect(g.started).toBe(true);
    expect(g.iterations.length).toBe(4); 
  });

  test('next_step_1_times', () => {
    let g = new GameState();
    g.start();
    g.nextStep();
    expect(g.state.id).toBe("swap");
    expect(g.driver).toBe(1);
    expect(g.navigator).toBe(0);
    expect(g.iterations[0].phase).toBe(TDDPhase.GREEN); 
  });  

  test('next_step_2_times', () => {
    let g = new GameState();
    g.start();
    g.nextStep();
    g.nextStep();
    expect(g.state.id).toBe("green");
    expect(g.driver).toBe(1);
    expect(g.navigator).toBe(0);
    expect(g.iterations[0].phase).toBe(TDDPhase.GREEN); 
  });  

  test('next_step_3_times', () => {
    let g = new GameState();
    g.start();
    for(var i = 0; i< 3; i++) g.nextStep();
        
    expect(g.state.id).toBe("refactor");
    expect(g.driver).toBe(1);
    expect(g.navigator).toBe(0);
    expect(g.iterations[0].phase).toBe(TDDPhase.REFACTOR); 
  });

  test('next_step_4_times', () => {
    let g = new GameState();
    g.start();
    for(var i = 0; i< 4; i++) g.nextStep();
        
    expect(g.state.id).toBe("red");
    expect(g.driver).toBe(1);
    expect(g.navigator).toBe(0);
    expect(g.iterations[1].phase).toBe(TDDPhase.RED); 
    expect(g.iterations[0].phase).toBe(TDDPhase.COMPLETED); 
  });

  test('next_step_5_times', () => {
    let g = new GameState();
    g.start();
    for(var i = 0; i< 5; i++) g.nextStep();
        
    expect(g.state.id).toBe("swap");
    expect(g.driver).toBe(0);
    expect(g.navigator).toBe(1);
    expect(g.iterations[1].phase).toBe(TDDPhase.GREEN); 

  });

  test('next_step_5_times', () => {
    let g = new GameState();
    g.start();
    for(var i = 0; i< 5; i++) g.nextStep();
        
    expect(g.state.id).toBe("swap");
    expect(g.driver).toBe(0);
    expect(g.navigator).toBe(1);
    expect(g.iterations[1].phase).toBe(TDDPhase.GREEN); 

  });

  test('next_step_16_times', () => {
    let g = new GameState();
    g.start();
    for(var i = 0; i< 16; i++) g.nextStep();
        
    expect(g.state.id).toBe("red");
    expect(g.driver).toBe(0);
    expect(g.navigator).toBe(1);
    expect(g.iterations[4].phase).toBe(TDDPhase.RED); 
    expect(g.iterations[3].phase).toBe(TDDPhase.COMPLETED); 
    expect(g.stepCount).toBe(16);
  });


  test('get_step_after_0_nexts', () => {
    let g = new GameState();
    g.start();
    const step = g.getStep();
    expect(step.stateName).toBe("red");
    expect(step.iteration).toBe(0);
    expect(step.driver).toBe("John");
  });

  test('get_step_after_1_nexts', () => {
    let g = new GameState();
    g.start();
    g.nextStep();
    const step = g.getStep();
    expect(step.stateName).toBe("swap");
    expect(step.iteration).toBe(0);
    expect(step.driver).toBe("Jane");
    expect(step.title).toBe("Swap pair programming roles")
  });

  test('get_step_after_3_nexts', () => {
    let g = new GameState();
    g.start();
    g.nextStep();
    g.nextStep();
    g.nextStep();
    const step = g.getStep();
    expect(step.stateName).toBe("refactor");
    expect(step.iteration).toBe(0);
    expect(step.driver).toBe("Jane");
    expect(step.title).toBe("Step:3 Make it Clean")
  });