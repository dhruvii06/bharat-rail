package com.railway.itsm.application;
import com.railway.itsm.domain.events.*;
import com.railway.itsm.domain.model.*;
import com.railway.itsm.domain.repository.IncidentRepository;
import com.railway.itsm.domain.strategy.*;
import java.time.Instant;
import java.util.*;
public final class IncidentManagementService {
    private final IncidentRepository repository;
    private final PriorityStrategy priorityStrategy;
    private final AssignmentStrategy assignmentStrategy;
    private final EventPublisher publisher;
    public IncidentManagementService(IncidentRepository repository,PriorityStrategy priorityStrategy,
            AssignmentStrategy assignmentStrategy,EventPublisher publisher){
        this.repository=repository;this.priorityStrategy=priorityStrategy;
        this.assignmentStrategy=assignmentStrategy;this.publisher=publisher;
    }
    public Incident report(Incident incident){
        repository.save(incident);
        publish(incident,"CREATED","Incident reported");
        return incident;
    }
    public void classifyAndAssign(Incident incident,Administrator admin,List<Technician> technicians,Instant now){
        incident.classify(priorityStrategy.calculate(incident),admin,now);
        publish(incident,"PRIORITIZED","Priority "+incident.getPriority());
        Technician selected=assignmentStrategy.select(incident,technicians);
        incident.assign(selected,admin,now);
        repository.save(incident);
        publish(incident,"ASSIGNED","Assigned to "+selected.getName());
    }
    public List<Incident> findPotentialDuplicates(Incident incoming){
        // Explainable heuristic: same service, category, and at least one significant title word.
        Set<String> words=importantWords(incoming.getTitle());
        return repository.findAll().stream().filter(i->!i.getId().equals(incoming.getId()))
          .filter(i->i.getAffectedService().getId().equals(incoming.getAffectedService().getId()))
          .filter(i->i.getCategory()==incoming.getCategory())
          .filter(i->i.getStatus()!=com.railway.itsm.domain.enums.IncidentStatus.CLOSED)
          .filter(i->importantWords(i.getTitle()).stream().anyMatch(words::contains))
          .toList();
    }
    private static Set<String> importantWords(String text){
        Set<String> words=new HashSet<>();
        for(String s:text.toLowerCase(Locale.ROOT).split("[^a-z0-9]+"))
            if(s.length()>=5 && !Set.of("during","issue","error","system","users").contains(s)) words.add(s);
        return words;
    }
    private void publish(Incident incident,String type,String details){
        publisher.publish(new IncidentEvent(incident.getId(),type,details,Instant.now()));
    }
}
